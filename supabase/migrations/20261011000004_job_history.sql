-- Audit fix: COMPLETED/CANCELLED/NO_SHOW jobs vanished from /jobs entirely
-- (list_my_upcoming_jobs only returns live states), leaving no history and no
-- way back to review. Past jobs mirror the upcoming read model, newest first.
--
create or replace function public.list_my_past_jobs(limit_count integer default 20)
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
  is_client boolean
),
  paid_additional_amount bigint,
  total_price_amount bigint
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
    and j.status in ('COMPLETED', 'CANCELLED', 'NO_SHOW')
  order by j.updated_at desc, j.id desc
  limit bounded_limit;
end;
$$;

revoke all on function public.list_my_past_jobs(integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_past_jobs(integer) to authenticated, service_role;
