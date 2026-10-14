-- YALO A1: autoridad única para el cierre con código.
--
-- Falla confirmada (auditoría YALO 14-10-2026): record_confirmation_code_attempt
-- persiste fallos en su propio RPC, pero requestCompletionAction llamaba a
-- transition_job_status DIRECTAMENTE. Un cliente autenticado podía invocar el
-- RPC de transición y adivinar códigos sin incrementar jamás el contador:
-- el rate-limit era evadible por diseño. Arreglar solo UI no alcanza.
--
-- Fix append-only:
--   1) Nuevo RPC request_job_completion(job, code) → 'COMPLETED' |
--      'MISMATCH' | 'LOCKED'. UNA sola transacción: verifica estado/rol/
--      código bajo lock, persiste MISMATCH sin RAISE (sin rollback que lo
--      borre) y transiciona SOLO con código válido. Orden único de locks
--      en el módulo de cierre: advisory primero, fila después.
--   2) transition_job_status RECHAZA la ruta IN_PROGRESS→COMPLETION_REQUESTED
--      siempre ('request completion through request_job_completion'): cierra
--      el bypass y elimina el par de locks inverso (transition tomaba
--      fila→advisory, riesgo de deadlock con el recorder). Resto idéntico.
-- Sin GUC de autorización, sin cambios de firma en otras rutas, sin push
-- a prod (runbook manual). Pagos reales OFF.

-- ============ A1.1: autoridad única de cierre ============

create or replace function public.request_job_completion(
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
  target_conversation public.conversations%rowtype;
  event_time timestamptz := timezone('utc', now());
  normalized_code text := nullif(btrim(coalesce(confirmation_code, '')), '');
  recent_failures integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  -- Orden único advisory→fila en todo el módulo de cierre.
  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> 'IN_PROGRESS' then
    raise exception using errcode = '40001', message = 'job state changed; refresh and retry';
  end if;

  if caller_id <> target_job.provider_user_id then
    raise exception using errcode = '42501', message = 'job transition is not allowed for this actor/state';
  end if;

  if target_job.confirmation_code is null then
    -- Sin código no hay secreto que adivinar: transición directa con los
    -- mismos efectos (rol y estado ya validados bajo lock).
    update public.jobs
    set status = 'COMPLETION_REQUESTED',
        updated_at = event_time,
        completion_requested_at = event_time
    where id = target_job_id;

    insert into public.job_events (
      job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
    ) values (
      target_job_id, caller_id, 'JOB_STATUS_CHANGED',
      'IN_PROGRESS', 'COMPLETION_REQUESTED', null, event_time
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
        target_job.conversation_id, null, 'SYSTEM',
        'El proveedor solicitó confirmar la finalización.', event_time
      );

      update public.conversations set last_message_at = event_time, updated_at = event_time
      where id = target_job.conversation_id;
    end if;

    return 'COMPLETED';
  end if;

  if normalized_code is null then
    raise exception using errcode = '22023', message = 'confirmation code is required to request completion';
  end if;

  select count(*) into recent_failures
  from public.job_confirmation_code_attempts
  where job_id = target_job_id
    and created_at > event_time - interval '10 minutes';
  if recent_failures >= 5 then
    return 'LOCKED';
  end if;

  if normalized_code <> target_job.confirmation_code then
    -- Sin RAISE a propósito: la excepción revertiría este INSERT y el
    -- fallo nunca persistiría (bug P1-01 original). El llamante mapea
    -- 'MISMATCH' al mensaje de UX.
    insert into public.job_confirmation_code_attempts (job_id, attempted_by_user_id)
    values (target_job_id, caller_id);
    return 'MISMATCH';
  end if;

  delete from public.job_confirmation_code_attempts where job_id = target_job_id;

  update public.jobs
  set status = 'COMPLETION_REQUESTED',
      updated_at = event_time,
      completion_requested_at = event_time
  where id = target_job_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
  ) values (
    target_job_id, caller_id, 'JOB_STATUS_CHANGED',
    'IN_PROGRESS', 'COMPLETION_REQUESTED', null, event_time
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
      target_job.conversation_id, null, 'SYSTEM',
      'El proveedor solicitó confirmar la finalización.', event_time
    );

    update public.conversations set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return 'COMPLETED';
end;
$$;

revoke all on function public.request_job_completion(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.request_job_completion(uuid, text)
to authenticated, service_role;

-- ============ A1.2: la ruta vieja rechaza el cierre con código ============

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
    -- YALO A1: autoridad única request_job_completion. La ruta directa
    -- permitía adivinar el código sin persistir intentos (bypass del
    -- rate-limit). Se rechaza siempre para que exista un solo camino
    -- auditable; además elimina el lock fila→advisory inverso al recorder.
    raise exception using errcode = '22023', message = 'request completion through request_job_completion';
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
