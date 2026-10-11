-- Código de confirmación del servicio (estilo Rappi/PedidosYa).
-- El cliente lo ve en Seguimiento; el prestador debe ingresarlo para poder
-- pedir la finalización. Sin código no hay COMPLETION_REQUESTED.

alter table public.jobs
  add column if not exists confirmation_code text;

update public.jobs
set confirmation_code = lpad((floor(random() * 10000))::int::text, 4, '0')
where confirmation_code is null;

-- El código solo sale por get_job_detail (y solo al cliente): ni siquiera
-- por REST directa lo puede leer el prestador.
revoke select (confirmation_code) on public.jobs from anon, authenticated;

alter table public.jobs
  alter column confirmation_code
    set default lpad((floor(random() * 10000))::int::text, 4, '0'),
  alter column confirmation_code set not null;

-- 1) transition_job_status con validación de código al pedir finalización.
-- Nueva firma (5 args): se dropea la anterior para no dejar el overload
-- viejo sin validación.
drop function if exists
  public.transition_job_status(uuid, public.job_status, public.job_status, text);

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
    if target_job.confirmation_code is not null
      and (confirmation_code is null or btrim(confirmation_code) <> target_job.confirmation_code) then
      raise exception using errcode = '22023', message = 'confirmation code is required to request completion';
    end if;
  elsif requested_status = 'COMPLETED' and target_job.status = 'COMPLETION_REQUESTED' then
    actor_allowed := caller_id = target_job.client_user_id;
  elsif requested_status = 'CANCELLED' and target_job.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED') then
    actor_allowed := true;
  elsif requested_status = 'DISPUTED' and target_job.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED') then
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
  set status = requested_status, updated_at = event_time
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

-- 2) get_job_detail expone el código solo al cliente (el prestador lo pide
-- en persona/chat, nunca lo lee de la API).
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
