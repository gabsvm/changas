-- Phase 06: fix participant display-name joins in Job read models.
-- public.profiles uses `id` as its auth user foreign key; the inherited
-- Phase 06 read models incorrectly referenced a non-existent `user_id` column.

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
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  left join public.job_private_locations loc on loc.job_id = j.id
  where j.id = target_job_id;
end;
$$;

create or replace function public.list_my_upcoming_jobs(limit_count integer default 20)
returns table (
  job_id uuid,
  job_status public.job_status,
  service_title text,
  counterparty_name text,
  schedule_type public.schedule_type,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_limit integer := least(greatest(coalesce(limit_count, 20), 1), 50);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    j.id,
    j.status,
    pv.service_title_snapshot,
    coalesce(peer.display_name, 'Usuario'),
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    j.updated_at
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  where caller_id in (j.client_user_id, j.provider_user_id)
    and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED', 'DISPUTED')
  order by coalesce(sv.starts_at, sv.deadline_at, j.confirmed_at) asc, j.id asc
  limit bounded_limit;
end;
$$;

revoke all on function public.get_job_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_detail(uuid) to authenticated, service_role;

revoke all on function public.list_my_upcoming_jobs(integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_upcoming_jobs(integer) to authenticated, service_role;
