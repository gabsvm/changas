-- Lote A+B (auditoría 14-10-2026): lifecycle P1-01 / P1-02 + settlement P1-05.
--
-- Append-only: no edita 20261013080000_lifecycle_hardening.sql ni ninguna
-- migración anterior. No agrega extensiones (no hay pg_background/dblink en
-- el repo; el patrón de serialización existente es pg_advisory_xact_lock).
-- No toca protección de main ni gates; se aplica por runbook (db push
-- prohibido). Pagos reales OFF.
--
-- P1-01 (rate-limit del código): el INSERT+RAISE en la misma transacción de
--   transition_job_status hacía rollback del conteo, así que el bloqueo de
--   5 fallos jamás se activaba. Fix en dos partes:
--   a) Nuevo RPC record_confirmation_code_attempt(job, code) → 'OK' |
--      'MISMATCH' | 'LOCKED' | 'NOT_REQUIRED'. Cada llamada es su propia
--      transacción, por eso su INSERT/DELETE sí persiste. Serializa con
--      advisory lock por job (patrón ya usado en slot holds).
--   b) transition_job_status ya NO inserta en fallos (solo lee el conteo y
--      valida); el INSERT se movió al recorder. Misma firma (5 args),
--      mismos mensajes de error.
--   Protocolo para la app (capa TS): ante COMPLETION_REQUESTED, llamar
--   primero al recorder; si devuelve 'MISMATCH'/'LOCKED', mostrar el error
--   sin llamar a transition; si devuelve 'OK', llamar a transition con el
--   código. Llamar a transition sin recorder mantiene la validación pero
--   no suma al conteo (documentado, sin ilusión de rate-limit).
--
-- P1-02 (auto_complete_stale_jobs): claim atómico con
--   SELECT ... FOR UPDATE SKIP LOCKED + UPDATE revalidando
--   status='COMPLETION_REQUESTED' y reloj bajo el lock. Una CANCELLED /
--   DISPUTED concurrente gana y el cron nunca la sobrescribe. El evento
--   JOB_AUTO_COMPLETED (y el mensaje) solo se insertan si el claim afectó
--   1 fila. Misma firma, mismo reloj (completion_requested_at con fallback
--   a updated_at, que se conserva como registro).
--
-- P1-05 (settlement): nuevo settled_amount_for_job() inmutable derivado de
--   la fila SUCCEEDED de job_settlement_attempts (índice único
--   job_settlement_attempts_one_succeeded_idx: un solo éxito por job, nunca
--   se recalcula desde scope-changes que pasan a PAID tras liquidar) más
--   amount_due_for_job() dinámico (0 si no COMPLETED o ya liquidado, si no
--   base + adicionales impagos). get_job_detail expone settled_amount_minor
--   (NULL hasta liquidar) sin cambiar ninguna columna existente.
--   get_job_settlement_snapshot NO se toca (firma y cuerpo intactos).

-- ============ P1-01a: recorder con persistencia real ============

create or replace function public.record_confirmation_code_attempt(
  target_job_id uuid,
  confirmation_code text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  event_time timestamptz := timezone('utc', now());
  normalized_code text := nullif(btrim(coalesce(confirmation_code, '')), '');
  recent_failures integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  -- Serializa conjeturas concurrentes del mismo job. Misma familia que los
  -- slot holds (pg_advisory_xact_lock por clave del job).
  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> 'IN_PROGRESS' then
    raise exception using errcode = '40001', message = 'job is not awaiting completion';
  end if;

  if target_job.confirmation_code is null then
    return 'NOT_REQUIRED';
  end if;

  select count(*) into recent_failures
  from public.job_confirmation_code_attempts
  where job_id = target_job_id
    and created_at > event_time - interval '10 minutes';

  if recent_failures >= 5 then
    return 'LOCKED';
  end if;

  if normalized_code is not null and normalized_code = target_job.confirmation_code then
    delete from public.job_confirmation_code_attempts where job_id = target_job_id;
    return 'OK';
  end if;

  -- Este INSERT commitea con la transacción propia del RPC, por eso el
  -- conteo sobrevive (a diferencia del INSERT+RAISE anterior, que hacía
  -- rollback y anulaba el rate-limit).
  insert into public.job_confirmation_code_attempts (job_id, attempted_by_user_id)
  values (target_job_id, caller_id);
  return 'MISMATCH';
end;
$$;

revoke all on function public.record_confirmation_code_attempt(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.record_confirmation_code_attempt(uuid, text)
to authenticated, service_role;

-- ============ P1-01b: transition lee el conteo, ya no inserta ============

create or replace function public.transition_job_status(
  target_job_id uuid,
  expected_status public.job_status,
  requested_status public.job_status,
  transition_reason text default null,
  confirmation_code text default null
)
returns public.job_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  target_conversation public.conversations%rowtype;
  event_time timestamptz := timezone('utc', now());
  actor_allowed boolean := false;
  -- Rate-limit: 5 fallos en 10 minutos bloquean el código por 10 minutos.
  -- El conteo lo persiste record_confirmation_code_attempt en su propia
  -- transacción; aquí solo se lee (un INSERT+RAISE haría rollback).
  recent_failures integer;
  auto_completed_at timestamptz;
  base_amount bigint;
  unpaid_amount bigint;
  is_settled boolean;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> expected_status then
    raise exception using errcode = '40001', message = 'job state changed; refresh and retry';
  end if;

  if requested_status = 'IN_PROGRESS' and target_job.status = 'CONFIRMED' then
    actor_allowed := caller_id = target_job.provider_user_id;
  elsif requested_status = 'COMPLETION_REQUESTED' and target_job.status = 'IN_PROGRESS' then
    actor_allowed := caller_id = target_job.provider_user_id;
    if target_job.confirmation_code is not null then
      if confirmation_code is null or char_length(btrim(confirmation_code)) = 0 then
        raise exception using errcode = '22023', message = 'confirmation code is required to request completion';
      end if;
      -- Serializa con el recorder para que contar-y-actuar sea atómico.
      perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));
      select count(*) into recent_failures
      from public.job_confirmation_code_attempts
      where job_id = target_job_id
        and created_at > event_time - interval '10 minutes';
      if recent_failures >= 5 then
        raise exception using errcode = 'P0001', message = 'confirmation code locked; too many attempts, try again later';
      end if;
      if btrim(confirmation_code) <> target_job.confirmation_code then
        -- P1-01: sin INSERT aquí a propósito. El INSERT seguido de RAISE
        -- hacía rollback y el fallo nunca persistía. El conteo lo escribe
        -- record_confirmation_code_attempt (commit propio); la app DEBE
        -- llamarlo antes de reintentar la transición.
        raise exception using errcode = '22023', message = 'confirmation code does not match';
      end if;
      delete from public.job_confirmation_code_attempts where job_id = target_job_id;
    end if;
  elsif requested_status = 'COMPLETED' and target_job.status = 'COMPLETION_REQUESTED' then
    actor_allowed := caller_id = target_job.client_user_id;
  elsif requested_status = 'CANCELLED' and target_job.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED') then
    actor_allowed := true;
  elsif requested_status = 'DISPUTED' and target_job.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED') then
    actor_allowed := true;
  elsif requested_status = 'DISPUTED' and target_job.status = 'COMPLETED' then
    -- Apelación acotada tras auto-complete: solo si el cierre fue
    -- automático y reciente (7 días), el cobro sigue pendiente
    -- (settlement DUE) y hay motivo. Un COMPLETED confirmado a mano
    -- por el cliente no se puede disputar.
    select max(created_at) into auto_completed_at
    from public.job_events
    where job_id = target_job_id
      and event_type = 'JOB_AUTO_COMPLETED';
    if auto_completed_at is null or auto_completed_at < event_time - interval '7 days' then
      raise exception using errcode = '55000', message = 'job can no longer be disputed';
    end if;
    select pv.price_amount into base_amount
    from public.proposal_versions pv
    where pv.id = target_job.accepted_proposal_version_id;
    select coalesce(sum(additional_amount_minor), 0) into unpaid_amount
    from public.job_scope_changes
    where job_id = target_job_id
      and status in ('AWAITING_PAYMENT', 'PAYMENT_FAILED');
    select exists (
      select 1 from public.job_settlement_attempts
      where job_id = target_job_id and status = 'SUCCEEDED'
    ) into is_settled;
    if is_settled or coalesce(base_amount, 0) + coalesce(unpaid_amount, 0) <= 0 then
      raise exception using errcode = '55000', message = 'job can no longer be disputed';
    end if;
    actor_allowed := true;
  elsif requested_status = 'NO_SHOW' and target_job.status = 'CONFIRMED' then
    actor_allowed := true;
  end if;

  if not actor_allowed then
    raise exception using errcode = '42501', message = 'job transition is not allowed for this actor/state';
  end if;

  if requested_status in ('CANCELLED', 'DISPUTED', 'NO_SHOW')
    and (transition_reason is null or char_length(btrim(transition_reason)) < 2) then
    raise exception using errcode = '22023', message = 'a reason is required for this transition';
  end if;

  update public.jobs
  set status = requested_status,
      updated_at = event_time,
      completion_requested_at = case
        when requested_status = 'COMPLETION_REQUESTED' then event_time
        when target_job.status = 'COMPLETION_REQUESTED' then null
        else completion_requested_at
      end
  where id = target_job_id;

  if requested_status in ('COMPLETED', 'CANCELLED', 'DISPUTED', 'NO_SHOW') then
    update public.provider_booking_slots set is_active = false where job_id = target_job_id;
  end if;

  insert into public.job_events (
    job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
  ) values (
    target_job_id,
    caller_id,
    'JOB_STATUS_CHANGED',
    target_job.status,
    requested_status,
    nullif(btrim(transition_reason), ''),
    event_time
  );

  select * into target_conversation
  from public.conversations
  where id = target_job.conversation_id;

  if target_conversation.id is not null
    and target_conversation.status = 'OPEN'
    and not exists (
      select 1 from public.user_blocks
      where conversation_id = target_job.conversation_id
    ) then
    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id,
      null,
      'SYSTEM',
      case requested_status
        when 'IN_PROGRESS' then 'El trabajo fue iniciado.'
        when 'COMPLETION_REQUESTED' then 'El proveedor solicitó confirmar la finalización.'
        when 'COMPLETED' then 'Trabajo completado.'
        when 'CANCELLED' then 'El trabajo fue cancelado.'
        when 'DISPUTED' then 'Se informó un problema con el trabajo.'
        when 'NO_SHOW' then 'Se registró una ausencia.'
        else 'El estado del trabajo cambió.'
      end,
      event_time
    );

    update public.conversations set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return requested_status;
end;
$$;

revoke all on function public.transition_job_status(uuid, public.job_status, public.job_status, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.transition_job_status(uuid, public.job_status, public.job_status, text, text)
to authenticated, service_role;

-- ============ P1-02: auto-complete atómico ============

create or replace function public.auto_complete_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  completed_count integer := 0;
  stale_job record;
  cutoff timestamptz := timezone('utc', now());
begin
  -- Claim atómico: FOR UPDATE SKIP LOCKED evita que dos workers tomen el
  -- mismo job; el UPDATE revalida estado + reloj bajo el lock, así una
  -- CANCELLED/DISPUTED concurrente gana y el cron nunca la sobrescribe.
  -- Evento y mensaje solo si el claim afectó 1 fila. El reloj
  -- completion_requested_at se conserva como registro (no se limpia).
  for stale_job in
    select id, conversation_id
    from public.jobs
    where status = 'COMPLETION_REQUESTED'
      and coalesce(completion_requested_at, updated_at) < cutoff - interval '7 days'
    order by coalesce(completion_requested_at, updated_at)
    limit 500
    for update skip locked
  loop
    update public.jobs
    set status = 'COMPLETED', updated_at = cutoff
    where id = stale_job.id
      and status = 'COMPLETION_REQUESTED'
      and coalesce(completion_requested_at, updated_at) < cutoff - interval '7 days';

    if not found then
      continue;
    end if;

    insert into public.job_events (job_id, actor_user_id, event_type, from_status, to_status, created_at)
    values (stale_job.id, null, 'JOB_AUTO_COMPLETED', 'COMPLETION_REQUESTED', 'COMPLETED', cutoff);

    if stale_job.conversation_id is not null then
      insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
      values (stale_job.conversation_id, null, 'SYSTEM', 'Trabajo confirmado automáticamente por falta de respuesta.', cutoff);

      update public.conversations
      set last_message_at = cutoff, updated_at = cutoff
      where id = stale_job.conversation_id;
    end if;

    completed_count := completed_count + 1;
  end loop;

  return completed_count;
end;
$$;

revoke all on function public.auto_complete_stale_jobs()
from public, anon, authenticated, service_role;

-- ============ P1-05: settled inmutable + due dinámico ============

-- Inmutable: monto de la fila SUCCEEDED (índice único
-- job_settlement_attempts_one_succeeded_idx: un solo éxito por job). Nunca
-- se recalcula desde job_scope_changes, cuyos estados pasan a PAID tras
-- liquidar. NULL hasta que el job liquida.
create or replace function public.settled_amount_for_job(target_job_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select max(amount_minor)
  from public.job_settlement_attempts
  where job_id = target_job_id
    and status = 'SUCCEEDED';
$$;

revoke all on function public.settled_amount_for_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.settled_amount_for_job(uuid)
to service_role;

-- Dinámico: lo que falta cobrar. 0 si no COMPLETED o ya liquidado; si no,
-- base + adicionales aprobados-impagos (cambia con cada pago de extras).
create or replace function public.amount_due_for_job(target_job_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.jobs%rowtype;
  base_amount bigint;
begin
  select * into target_job from public.jobs where id = target_job_id;
  if target_job.id is null then
    return 0;
  end if;
  if target_job.status <> 'COMPLETED' then
    return 0;
  end if;
  if public.job_is_settled(target_job.id) then
    return 0;
  end if;
  select coalesce(price_amount, 0) into base_amount
  from public.proposal_versions
  where id = target_job.accepted_proposal_version_id;
  return coalesce(base_amount, 0) + public.unpaid_scope_additional_for_job(target_job.id);
end;
$$;

revoke all on function public.amount_due_for_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.amount_due_for_job(uuid)
to service_role;

-- get_job_detail expone settled_amount_minor (DROP requerido: cambia el tipo
-- de retorno; es un read model RPC sin vistas dependientes). Copia exacta de
-- la versión de lifecycle_hardening + 1 columna al final; ninguna columna
-- existente cambia de semántica. Contrato UI: preferir settled_amount_minor
-- cuando settlement_status = 'SETTLED', con fallback a settlement_total_minor.
drop function if exists public.get_job_detail(uuid);

create or replace function public.get_job_detail(target_job_id uuid)
returns table (
  job_id uuid,
  conversation_id uuid,
  job_status public.job_status,
  client_user_id uuid,
  provider_user_id uuid,
  service_id uuid,
  service_title text,
  scope_snapshot text,
  base_price_amount bigint,
  currency_code text,
  modality public.service_modality,
  schedule_type public.schedule_type,
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  schedule_deadline_at timestamptz,
  expected_duration_minutes integer,
  counterparty_name text,
  exact_address text,
  exact_latitude double precision,
  exact_longitude double precision,
  access_notes text,
  confirmed_at timestamptz,
  updated_at timestamptz,
  completion_requested_at timestamptz,
  paid_additional_amount bigint,
  total_price_amount bigint,
  settlement_status text,
  settlement_total_minor bigint,
  settlement_unpaid_extras_minor bigint,
  settlement_unpaid_extra_ids uuid[],
  confirmation_code text,
  settled_amount_minor bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.jobs j
    where j.id = target_job_id
      and caller_id in (j.client_user_id, j.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  return query
  select
    j.id,
    j.conversation_id,
    j.status,
    j.client_user_id,
    j.provider_user_id,
    j.service_id,
    pv.service_title_snapshot,
    pv.scope_snapshot,
    pv.price_amount,
    pv.currency_code,
    pv.modality,
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    sv.expected_duration_minutes,
    coalesce(peer.display_name, 'Usuario'),
    case when public.can_view_job_exact_location(j.id) then loc.exact_address end,
    case when public.can_view_job_exact_location(j.id) then loc.latitude end,
    case when public.can_view_job_exact_location(j.id) then loc.longitude end,
    case when public.can_view_job_exact_location(j.id) then loc.access_notes end,
    j.confirmed_at,
    j.updated_at,
    j.completion_requested_at,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount + public.paid_scope_additional_for_job(j.id),
    case
      when j.status <> 'COMPLETED' then 'NOT_DUE'
      when public.job_is_settled(j.id) then 'SETTLED'
      when coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id) <= 0 then 'NOT_REQUIRED'
      else 'DUE'
    end,
    coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id),
    public.unpaid_scope_additional_for_job(j.id),
    public.unpaid_scope_change_ids_for_job(j.id),
    case when caller_id = j.client_user_id then j.confirmation_code end,
    public.settled_amount_for_job(j.id)
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  left join public.job_private_locations loc on loc.job_id = j.id
  where j.id = target_job_id;
end;
$$;

revoke all on function public.get_job_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_detail(uuid)
to authenticated, service_role;
