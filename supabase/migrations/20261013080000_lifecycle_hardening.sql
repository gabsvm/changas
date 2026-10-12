-- Slice Lifecycle: rate-limit del código de 4 dígitos, reloj de
-- auto-complete sin updated_at, motivos de rechazo en propuestas y
-- scope-changes, y ventana de apelación acotada tras auto-complete.
--
-- No toca checkout, settlements, identidad ni pagos. No redefine
-- get_job_settlement_snapshot, submit_provider_identity_review ni
-- ninguna función de identidad. Cero cambios en prod: este archivo se
-- aplica por runbook manual (db push prohibido).
--
-- Compatibilidad: los overloads viejos respond_to_proposal(uuid,text) y
-- respond_job_scope_change(uuid,text) se conservan como wrappers finos
-- que delegan al de 3 args (los exigen phase-05 #21 y phase-06 #17).

-- 1) Reloj de auto-complete: cuándo se pidió la finalización. Se setea
-- al entrar a COMPLETION_REQUESTED y se limpia al salir por transición
-- manual; el auto-complete por cron lo conserva como registro.
alter table public.jobs
  add column if not exists completion_requested_at timestamptz;

-- Backfill honesto: los que ya están en COMPLETION_REQUESTED usan
-- updated_at como aproximación (documentado como fallback).
update public.jobs
set completion_requested_at = updated_at
where status = 'COMPLETION_REQUESTED'
  and completion_requested_at is null;

-- 2) Motivos de rechazo (opcionales, visibles en el hilo).
alter table public.proposals
  add column if not exists response_reason text
    check (response_reason is null or char_length(btrim(response_reason)) between 2 and 1000);

alter table public.job_scope_changes
  add column if not exists response_reason text
    check (response_reason is null or char_length(btrim(response_reason)) between 2 and 1000);

-- 3) Intentos fallidos del código de confirmación (rate-limit).
-- Solo la escribe transition_job_status (security definer); sin grants
-- directos para que nadie la lea ni la manipule por REST.
create table if not exists public.job_confirmation_code_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  attempted_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists job_confirmation_code_attempts_job_created_idx
on public.job_confirmation_code_attempts (job_id, created_at desc);

alter table public.job_confirmation_code_attempts enable row level security;
revoke all privileges on table public.job_confirmation_code_attempts
from public, anon, authenticated, service_role;

-- 4) transition_job_status: rate-limit + reloj + apelación acotada.
-- Misma firma (5 args): CREATE OR REPLACE sin dropear.
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
      select count(*) into recent_failures
      from public.job_confirmation_code_attempts
      where job_id = target_job_id
        and created_at > event_time - interval '10 minutes';
      if recent_failures >= 5 then
        raise exception using errcode = 'P0001', message = 'confirmation code locked; too many attempts, try again later';
      end if;
      if btrim(confirmation_code) <> target_job.confirmation_code then
        insert into public.job_confirmation_code_attempts (job_id, attempted_by_user_id)
        values (target_job_id, caller_id);
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

-- 5) Auto-complete con el reloj dedicado y fallback a updated_at para
-- filas anteriores a esta migración. Solo se reemplaza el cuerpo; el
-- cron 'jobs-auto-complete' existente sigue apuntando a esta firma.
create or replace function public.auto_complete_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  completed_count integer := 0;
  stale_job record;
begin
  for stale_job in
    select id, conversation_id
    from public.jobs
    where status = 'COMPLETION_REQUESTED'
      and coalesce(completion_requested_at, updated_at) < timezone('utc', now()) - interval '7 days'
    order by coalesce(completion_requested_at, updated_at)
    limit 500
  loop
    update public.jobs
    set status = 'COMPLETED', updated_at = timezone('utc', now())
    where id = stale_job.id;

    insert into public.job_events (job_id, actor_user_id, event_type, from_status, to_status, created_at)
    values (stale_job.id, null, 'JOB_AUTO_COMPLETED', 'COMPLETION_REQUESTED', 'COMPLETED', timezone('utc', now()));

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (stale_job.conversation_id, null, 'SYSTEM', 'Trabajo confirmado automáticamente por falta de respuesta.', timezone('utc', now()));

    update public.conversations
    set last_message_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = stale_job.conversation_id;

    completed_count := completed_count + 1;
  end loop;

  return completed_count;
end;
$$;

revoke all on function public.auto_complete_stale_jobs()
from public, anon, authenticated, service_role;

-- 6) respond_to_proposal con motivo de rechazo opcional. La firma vieja
-- (uuid,text) se conserva como wrapper fino que delega (la exigen los
-- tests viejos); el nuevo overload (uuid,text,text) lleva la lógica.
create or replace function public.respond_to_proposal(
  target_proposal_id uuid,
  response_action text,
  response_reason text default null
)
returns public.proposal_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_proposal public.proposals%rowtype;
  current_version public.proposal_versions%rowtype;
  normalized_action text := upper(btrim(response_action));
  normalized_reason text := nullif(btrim(coalesce(response_reason, '')), '');
  next_status public.proposal_status;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null
    or caller_id not in (target_proposal.client_user_id, target_proposal.provider_user_id) then
    raise exception using errcode = '42501', message = 'proposal access denied';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = target_proposal.conversation_id
      and (
        (b.blocker_user_id = caller_id and b.blocked_user_id in (target_proposal.client_user_id, target_proposal.provider_user_id))
        or (b.blocked_user_id = caller_id and b.blocker_user_id in (target_proposal.client_user_id, target_proposal.provider_user_id))
      )
  ) then
    raise exception using errcode = '42501', message = 'conversation proposals are blocked';
  end if;

  if target_proposal.status <> 'OPEN' then
    return target_proposal.status;
  end if;

  if target_proposal.expires_at is not null and target_proposal.expires_at <= event_time then
    update public.proposals set status = 'EXPIRED' where id = target_proposal_id;
    insert into public.proposal_events (proposal_id, actor_user_id, event_type, created_at)
    values (target_proposal_id, null, 'PROPOSAL_EXPIRED', event_time);
    return 'EXPIRED';
  end if;

  select * into current_version
  from public.proposal_versions
  where id = target_proposal.current_version_id;

  case normalized_action
    when 'WITHDRAW' then
      if caller_id <> current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'only the current proposal author can withdraw it';
      end if;
      next_status := 'WITHDRAWN';
    when 'REJECT' then
      if caller_id = current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'proposal author cannot reject their own terms';
      end if;
      if normalized_reason is not null and char_length(normalized_reason) < 2 then
        raise exception using errcode = '22023', message = 'rejection reason is too short';
      end if;
      next_status := 'REJECTED';
    when 'ACCEPT' then
      if current_version.price_amount is null then
        raise exception using errcode = '22023', message = 'a priced proposal is required before acceptance';
      end if;
      if caller_id = current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'proposal author cannot accept their own terms';
      end if;
      if caller_id = target_proposal.client_user_id
        and current_version.authored_by_user_id <> target_proposal.provider_user_id then
        raise exception using errcode = '42501', message = 'client can only accept provider-authored terms';
      end if;
      if caller_id = target_proposal.provider_user_id
        and current_version.authored_by_user_id <> target_proposal.client_user_id then
        raise exception using errcode = '42501', message = 'provider can only accept client-authored terms';
      end if;
      next_status := 'ACCEPTED';
    else
      raise exception using errcode = '22023', message = 'unknown proposal action';
  end case;

  update public.proposals
  set status = next_status,
      accepted_version_id = case
        when normalized_action = 'ACCEPT' then current_version.id
        else accepted_version_id
      end,
      response_reason = case
        when normalized_action = 'REJECT' then normalized_reason
        else response_reason
      end,
      updated_at = event_time
  where id = target_proposal_id;

  if normalized_action = 'ACCEPT' then
  insert into public.jobs (
    conversation_id,
    service_id,
    client_user_id,
    provider_user_id,
    accepted_proposal_version_id,
    payment_attempt_id,
    status,
    confirmed_at,
    created_at,
    updated_at
  ) values (
    target_proposal.conversation_id,
    target_proposal.service_id,
    target_proposal.client_user_id,
    target_proposal.provider_user_id,
    current_version.id,
    null,
    'CONFIRMED',
    event_time,
    event_time,
    event_time
  )
  on conflict (accepted_proposal_version_id)
  do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id;
  end if;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_proposal_id,
    current_version.id,
    caller_id,
    case normalized_action
      when 'ACCEPT' then 'PROPOSAL_ACCEPTED'
      when 'REJECT' then 'PROPOSAL_REJECTED'
      else 'PROPOSAL_WITHDRAWN'
    end,
    jsonb_build_object('status', next_status::text, 'reason', normalized_reason),
    event_time
  );

  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_proposal.conversation_id,
    null,
    'SYSTEM',
    case normalized_action
      when 'ACCEPT' then 'Propuesta aceptada. ¡Trabajo confirmado!'
      when 'REJECT' then case
        when normalized_reason is not null then 'La propuesta fue rechazada: ' || normalized_reason
        else 'La propuesta fue rechazada.'
      end
      else 'La propuesta fue retirada.'
    end,
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return next_status;
end;
$$;

revoke all on function public.respond_to_proposal(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_to_proposal(uuid, text, text)
to authenticated, service_role;

-- Wrapper de compatibilidad (firma histórica): delega al overload con
-- motivo. El guard de user_blocks vive en la firma delegada.
create or replace function public.respond_to_proposal(
  target_proposal_id uuid,
  response_action text
)
returns public.proposal_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- user_blocks: la conversación bloqueada la rechaza la firma de 3 args.
  return public.respond_to_proposal(target_proposal_id, response_action, null);
end;
$$;

revoke all on function public.respond_to_proposal(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_to_proposal(uuid, text)
to authenticated, service_role;

-- list_conversation_proposals expone el motivo (visible en el hilo).
-- DROP requerido: cambia el tipo de retorno. Es un read model RPC sin
-- vistas dependientes.
drop function if exists public.list_conversation_proposals(uuid);

create or replace function public.list_conversation_proposals(
  target_conversation_id uuid
)
returns table (
  proposal_id uuid,
  proposal_kind public.proposal_kind,
  proposal_status public.proposal_status,
  created_by_user_id uuid,
  current_version_id uuid,
  accepted_version_id uuid,
  version_number integer,
  authored_by_user_id uuid,
  service_title text,
  modality public.service_modality,
  scope_text text,
  price_amount bigint,
  currency_code text,
  schedule_type public.schedule_type,
  schedule_start_at timestamptz,
  schedule_end_at timestamptz,
  deadline_at timestamptz,
  expected_duration_minutes integer,
  includes_text text,
  materials_notes_text text,
  response_reason text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
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
    from public.conversations c
    where c.id = target_conversation_id
      and caller_id in (c.client_user_id, c.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  return query
  select
    p.id,
    p.kind,
    p.status,
    p.created_by_user_id,
    p.current_version_id,
    p.accepted_version_id,
    v.version_number,
    v.authored_by_user_id,
    v.service_title_snapshot,
    v.modality,
    v.scope_snapshot,
    v.price_amount,
    v.currency_code,
    v.schedule_type,
    v.schedule_start_at,
    v.schedule_end_at,
    v.deadline_at,
    v.expected_duration_minutes,
    v.includes_snapshot,
    v.materials_notes_snapshot,
    p.response_reason,
    p.expires_at,
    p.created_at,
    p.updated_at
  from public.proposals p
  join public.proposal_versions v on v.id = p.current_version_id
  where p.conversation_id = target_conversation_id
  order by p.created_at asc, p.id asc;
end;
$$;

revoke all on function public.list_conversation_proposals(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_conversation_proposals(uuid)
to authenticated, service_role;

-- 7) respond_job_scope_change con motivo de rechazo opcional + aviso en
-- el hilo. La firma vieja (uuid,text) se conserva como wrapper fino.
create or replace function public.respond_job_scope_change(
  target_scope_change_id uuid,
  response_action text,
  response_reason text default null
)
returns public.job_scope_change_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_change public.job_scope_changes%rowtype;
  target_job public.jobs%rowtype;
  target_conversation public.conversations%rowtype;
  normalized_action text := upper(btrim(response_action));
  normalized_reason text := nullif(btrim(coalesce(response_reason, '')), '');
  next_status public.job_scope_change_status;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into target_change from public.job_scope_changes where id = target_scope_change_id for update;
  if target_change.id is null then raise exception using errcode = 'P0002', message = 'scope change not found'; end if;
  select * into target_job from public.jobs where id = target_change.job_id for update;
  if caller_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client can respond to a scope change';
  end if;
  if target_change.status <> 'OPEN' then return target_change.status; end if;

  if normalized_action = 'REJECT' then
    if normalized_reason is not null and char_length(normalized_reason) < 2 then
      raise exception using errcode = '22023', message = 'rejection reason is too short';
    end if;
    next_status := 'REJECTED';
  elsif normalized_action = 'ACCEPT' then
    next_status := case when target_change.additional_amount_minor > 0 then 'AWAITING_PAYMENT' else 'PAID' end;
  else
    raise exception using errcode = '22023', message = 'invalid scope change response';
  end if;

  update public.job_scope_changes
  set status = next_status,
      client_responded_at = event_time,
      response_reason = case
        when normalized_action = 'REJECT' then normalized_reason
        else response_reason
      end,
      updated_at = event_time
  where id = target_scope_change_id;
  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job.id, caller_id, case when normalized_action = 'ACCEPT' then 'SCOPE_CHANGE_ACCEPTED' else 'SCOPE_CHANGE_REJECTED' end,
    jsonb_build_object('scope_change_id', target_scope_change_id, 'status', next_status::text, 'reason', normalized_reason));

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
      case normalized_action
        when 'ACCEPT' then 'Cambio de alcance aceptado.'
        else case
          when normalized_reason is not null then 'Cambio de alcance rechazado: ' || normalized_reason
          else 'Cambio de alcance rechazado.'
        end
      end,
      event_time
    );

    update public.conversations
    set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return next_status;
end;
$$;

revoke all on function public.respond_job_scope_change(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_job_scope_change(uuid, text, text)
to authenticated, service_role;

-- Wrapper de compatibilidad (firma histórica): delega al overload con
-- motivo nulo.
create or replace function public.respond_job_scope_change(
  target_scope_change_id uuid,
  response_action text
)
returns public.job_scope_change_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return public.respond_job_scope_change(target_scope_change_id, response_action, null);
end;
$$;

revoke all on function public.respond_job_scope_change(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_job_scope_change(uuid, text)
to authenticated, service_role;

-- list_job_scope_changes expone el motivo. DROP requerido: cambia el
-- tipo de retorno. Read model RPC sin vistas dependientes.
drop function if exists public.list_job_scope_changes(uuid);

create or replace function public.list_job_scope_changes(target_job_id uuid)
returns table (
  scope_change_id uuid,
  requested_by_user_id uuid,
  change_status public.job_scope_change_status,
  scope_snapshot text,
  additional_amount_minor bigint,
  currency_code text,
  response_reason text,
  client_responded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if not exists (
    select 1 from public.jobs j where j.id = target_job_id
      and caller_id in (j.client_user_id, j.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  return query
  select s.id, s.requested_by_user_id, s.status, s.scope_snapshot,
    s.additional_amount_minor, s.currency_code, s.response_reason, s.client_responded_at,
    s.created_at, s.updated_at
  from public.job_scope_changes s
  where s.job_id = target_job_id
  order by s.created_at desc, s.id desc;
end;
$$;

revoke all on function public.list_job_scope_changes(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_job_scope_changes(uuid)
to authenticated, service_role;

-- 8) get_job_detail expone completion_requested_at (reloj honesto para
-- la UI). DROP requerido: cambia el tipo de retorno. Copia exacta de la
-- versión de job_confirmation_code + 1 columna; grants preservados.
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
  confirmation_code text
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
    case when caller_id = j.client_user_id then j.confirmation_code end
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
