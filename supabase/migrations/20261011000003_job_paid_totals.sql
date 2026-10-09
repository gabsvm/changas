-- Audit fix: PAID scope changes (e.g. an agreed spare part) never updated the
-- job price anywhere. Both job read models now expose paid_additional_amount
-- and total_price_amount (base + PAID additionals) so every surface charges,
-- lists, and displays the real agreed total.
--
-- Paid scope changes never flowed into the job price: every surface read the
-- original accepted version. This helper centralizes the PAID additional sum;
-- service_role-only because it takes any job id without a caller check, and it
-- is only ever called from owner-executed read models.
create or replace function public.paid_scope_additional_for_job(target_job_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(sum(additional_amount_minor), 0)
  from public.job_scope_changes
  where job_id = target_job_id
    and status = 'PAID';
$$;

revoke all on function public.paid_scope_additional_for_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.paid_scope_additional_for_job(uuid)
to service_role;

-- OUT columns changed: Postgres requires drop + recreate (grants re-applied below).
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
  total_price_amount bigint
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
    pv.price_amount + public.paid_scope_additional_for_job(j.id)
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

drop function if exists public.list_my_upcoming_jobs(integer);

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
  updated_at timestamptz,
  base_price_amount bigint,
  currency_code text,
  is_client boolean,
  paid_additional_amount bigint,
  total_price_amount bigint
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
    j.updated_at,
    pv.price_amount,
    pv.currency_code,
    caller_id = j.client_user_id,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount + public.paid_scope_additional_for_job(j.id)
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

revoke all on function public.list_my_upcoming_jobs(integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_upcoming_jobs(integer) to authenticated, service_role;
