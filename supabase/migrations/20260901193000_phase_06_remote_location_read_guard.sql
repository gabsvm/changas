-- Phase 06: keep exact-location visibility aligned across RLS and the Job read model.
-- The immutable accepted proposal modality is authoritative. REMOTE Jobs must not
-- expose an exact on-site location, including legacy rows inserted out-of-band.

create or replace function public.can_view_job_exact_location(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.jobs j
    join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
    where j.id = target_job_id
      and pv.modality <> 'REMOTE'
      and (
        auth.uid() = j.client_user_id
        or (
          auth.uid() = j.provider_user_id
          and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED')
        )
      )
  );
$$;

revoke all on function public.can_view_job_exact_location(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.can_view_job_exact_location(uuid)
to authenticated, service_role;

drop policy if exists job_private_location_select on public.job_private_locations;
create policy job_private_location_select
on public.job_private_locations for select to authenticated
using (public.can_view_job_exact_location(job_id));

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
    case when public.can_view_job_exact_location(j.id) then loc.exact_address end,
    case when public.can_view_job_exact_location(j.id) then loc.latitude end,
    case when public.can_view_job_exact_location(j.id) then loc.longitude end,
    case when public.can_view_job_exact_location(j.id) then loc.access_notes end,
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

revoke all on function public.get_job_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_detail(uuid)
to authenticated, service_role;
