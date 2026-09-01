-- Phase 06 participant-safe job read models.

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
    select 1 from public.jobs j
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
    case
      when caller_id = j.client_user_id
        or (caller_id = j.provider_user_id and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED'))
      then loc.exact_address
    end,
    case
      when caller_id = j.client_user_id
        or (caller_id = j.provider_user_id and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED'))
      then loc.latitude
    end,
    case
      when caller_id = j.client_user_id
        or (caller_id = j.provider_user_id and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED'))
      then loc.longitude
    end,
    case
      when caller_id = j.client_user_id
        or (caller_id = j.provider_user_id and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED'))
      then loc.access_notes
    end,
    j.confirmed_at,
    j.updated_at
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.user_id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  left join public.job_private_locations loc on loc.job_id = j.id
  where j.id = target_job_id;
end;
$$;

create or replace function public.list_job_events(
  target_job_id uuid,
  limit_count integer default 100
)
returns table (
  event_id uuid,
  actor_user_id uuid,
  event_type text,
  from_status public.job_status,
  to_status public.job_status,
  reason text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_limit integer := least(greatest(coalesce(limit_count, 100), 1), 200);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if not exists (
    select 1 from public.jobs j where j.id = target_job_id
      and caller_id in (j.client_user_id, j.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  return query
  select e.id, e.actor_user_id, e.event_type, e.from_status, e.to_status,
    e.reason, e.metadata, e.created_at
  from public.job_events e
  where e.job_id = target_job_id
  order by e.created_at asc, e.id asc
  limit bounded_limit;
end;
$$;

create or replace function public.list_job_reschedule_requests(target_job_id uuid)
returns table (
  request_id uuid,
  requested_by_user_id uuid,
  request_status public.reschedule_request_status,
  schedule_type public.schedule_type,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  expected_duration_minutes integer,
  reason text,
  responded_by_user_id uuid,
  responded_at timestamptz,
  created_at timestamptz
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
  select r.id, r.requested_by_user_id, r.status, r.schedule_type, r.starts_at,
    r.ends_at, r.deadline_at, r.expected_duration_minutes, r.reason,
    r.responded_by_user_id, r.responded_at, r.created_at
  from public.job_reschedule_requests r
  where r.job_id = target_job_id
  order by r.created_at desc, r.id desc;
end;
$$;

create or replace function public.list_job_scope_changes(target_job_id uuid)
returns table (
  scope_change_id uuid,
  requested_by_user_id uuid,
  change_status public.job_scope_change_status,
  scope_snapshot text,
  additional_amount_minor bigint,
  currency_code text,
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
    s.additional_amount_minor, s.currency_code, s.client_responded_at,
    s.created_at, s.updated_at
  from public.job_scope_changes s
  where s.job_id = target_job_id
  order by s.created_at desc, s.id desc;
end;
$$;

revoke all on function public.get_job_detail(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_job_detail(uuid) to authenticated, service_role;
revoke all on function public.list_job_events(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_job_events(uuid, integer) to authenticated, service_role;
revoke all on function public.list_job_reschedule_requests(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_job_reschedule_requests(uuid) to authenticated, service_role;
revoke all on function public.list_job_scope_changes(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_job_scope_changes(uuid) to authenticated, service_role;
