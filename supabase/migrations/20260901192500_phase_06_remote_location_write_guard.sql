-- Phase 06: exact private locations are only meaningful for jobs that may be performed on-site.
-- The accepted proposal snapshot is authoritative; a REMOTE job must never accept an exact address.

create or replace function public.set_job_exact_location(
  target_job_id uuid,
  exact_address_text text,
  lat double precision default null,
  lng double precision default null,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_job
  from public.jobs
  where id = target_job_id;

  if target_job.id is null or caller_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client can set the exact job location';
  end if;

  if target_job.status not in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED') then
    raise exception using errcode = '42501', message = 'exact location is unavailable for this job state';
  end if;

  if exists (
    select 1
    from public.proposal_versions pv
    where pv.id = target_job.accepted_proposal_version_id
      and pv.modality = 'REMOTE'
  ) then
    raise exception using errcode = '22023', message = 'remote jobs do not accept an exact on-site location';
  end if;

  insert into public.job_private_locations (
    job_id,
    client_user_id,
    exact_address,
    latitude,
    longitude,
    access_notes
  ) values (
    target_job.id,
    caller_id,
    btrim(exact_address_text),
    lat,
    lng,
    nullif(btrim(notes), '')
  )
  on conflict (job_id) do update set
    exact_address = excluded.exact_address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    access_notes = excluded.access_notes,
    updated_at = timezone('utc', now());
end;
$$;
