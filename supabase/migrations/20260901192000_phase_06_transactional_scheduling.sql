-- Phase 06: make fixed-slot confirmation and reschedule acceptance revalidate
-- recurring availability, exception blocks, confirmed bookings and active payment holds
-- under the same provider-scoped transaction lock used by hold_proposal_slot().

create or replace function public.provider_slot_is_available_internal(
  target_provider_user_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  excluded_hold_id uuid default null,
  excluded_job_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  has_active_rules boolean;
begin
  if target_provider_user_id is null
     or requested_starts_at is null
     or requested_ends_at is null
     or requested_ends_at <= requested_starts_at then
    return false;
  end if;

  select exists (
    select 1
    from public.availability_rules ar
    where ar.provider_user_id = target_provider_user_id
      and ar.is_active
  ) into has_active_rules;

  if has_active_rules and not exists (
    select 1
    from public.availability_rules ar
    where ar.provider_user_id = target_provider_user_id
      and ar.is_active
      and extract(dow from requested_starts_at at time zone ar.timezone)::smallint = ar.weekday
      and (requested_starts_at at time zone ar.timezone)::date =
          (requested_ends_at at time zone ar.timezone)::date
      and (requested_starts_at at time zone ar.timezone)::time >= ar.start_time
      and (requested_ends_at at time zone ar.timezone)::time <= ar.end_time
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.availability_blocks ab
    where ab.provider_user_id = target_provider_user_id
      and tstzrange(ab.starts_at, ab.ends_at, '[)') &&
          tstzrange(requested_starts_at, requested_ends_at, '[)')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.provider_booking_slots pbs
    where pbs.provider_user_id = target_provider_user_id
      and pbs.is_active
      and (excluded_job_id is null or pbs.job_id <> excluded_job_id)
      and tstzrange(pbs.starts_at, pbs.ends_at, '[)') &&
          tstzrange(requested_starts_at, requested_ends_at, '[)')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.provider_slot_holds psh
    where psh.provider_user_id = target_provider_user_id
      and psh.released_at is null
      and psh.expires_at > timezone('utc', now())
      and (excluded_hold_id is null or psh.id <> excluded_hold_id)
      and tstzrange(psh.starts_at, psh.ends_at, '[)') &&
          tstzrange(requested_starts_at, requested_ends_at, '[)')
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.provider_slot_is_available_internal(uuid, timestamptz, timestamptz, uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.provider_slot_is_available(
  target_provider_user_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  excluded_hold_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.provider_slot_is_available_internal(
    target_provider_user_id,
    requested_starts_at,
    requested_ends_at,
    excluded_hold_id,
    null
  );
$$;

create or replace function public.initialize_job_schedule()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  proposal_version public.proposal_versions%rowtype;
  effective_type public.schedule_type;
  schedule_id uuid;
  own_hold_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  select * into proposal_version
  from public.proposal_versions
  where id = new.accepted_proposal_version_id;

  effective_type := proposal_version.schedule_type;
  if effective_type = 'FIXED_SLOT' and (proposal_version.schedule_start_at is null or proposal_version.schedule_end_at is null) then
    effective_type := 'UNSCHEDULED';
  elsif effective_type = 'FLEXIBLE_WINDOW' and (proposal_version.schedule_start_at is null or proposal_version.schedule_end_at is null) then
    effective_type := 'UNSCHEDULED';
  elsif effective_type = 'DEADLINE' and proposal_version.deadline_at is null then
    effective_type := 'UNSCHEDULED';
  end if;

  if effective_type = 'FIXED_SLOT' then
    perform pg_advisory_xact_lock(hashtextextended(new.provider_user_id::text, 0));

    update public.provider_slot_holds
    set released_at = event_time,
        updated_at = event_time
    where provider_user_id = new.provider_user_id
      and released_at is null
      and expires_at <= event_time;

    select psh.id into own_hold_id
    from public.provider_slot_holds psh
    where psh.accepted_proposal_version_id = new.accepted_proposal_version_id
      and psh.provider_user_id = new.provider_user_id
      and psh.client_user_id = new.client_user_id
      and psh.released_at is null
      and psh.expires_at > event_time
      and psh.starts_at = proposal_version.schedule_start_at
      and psh.ends_at = proposal_version.schedule_end_at
    order by psh.created_at desc
    limit 1
    for update;

    if not public.provider_slot_is_available_internal(
      new.provider_user_id,
      proposal_version.schedule_start_at,
      proposal_version.schedule_end_at,
      own_hold_id,
      null
    ) then
      raise exception using errcode = '23P01', message = 'accepted fixed slot is no longer available';
    end if;
  end if;

  insert into public.job_schedule_versions (
    job_id,
    version_number,
    schedule_type,
    starts_at,
    ends_at,
    deadline_at,
    expected_duration_minutes,
    authored_by_user_id,
    source
  ) values (
    new.id,
    1,
    effective_type,
    case when effective_type in ('FIXED_SLOT', 'FLEXIBLE_WINDOW') then proposal_version.schedule_start_at end,
    case when effective_type in ('FIXED_SLOT', 'FLEXIBLE_WINDOW') then proposal_version.schedule_end_at end,
    case when effective_type = 'DEADLINE' then proposal_version.deadline_at end,
    proposal_version.expected_duration_minutes,
    proposal_version.authored_by_user_id,
    'ACCEPTED_PROPOSAL'
  ) returning id into schedule_id;

  update public.jobs
  set current_schedule_version_id = schedule_id
  where id = new.id;

  if effective_type = 'FIXED_SLOT' then
    insert into public.provider_booking_slots (job_id, provider_user_id, starts_at, ends_at)
    values (new.id, new.provider_user_id, proposal_version.schedule_start_at, proposal_version.schedule_end_at);

    if own_hold_id is not null then
      update public.provider_slot_holds
      set released_at = event_time,
          updated_at = event_time
      where id = own_hold_id;

      insert into public.proposal_events (
        proposal_id,
        proposal_version_id,
        actor_user_id,
        event_type,
        metadata
      ) values (
        proposal_version.proposal_id,
        proposal_version.id,
        new.client_user_id,
        'PAYMENT_SLOT_CONSUMED',
        jsonb_build_object('slot_hold_id', own_hold_id, 'job_id', new.id)
      );
    end if;
  end if;

  insert into public.job_events (job_id, actor_user_id, event_type, to_status, metadata)
  values (new.id, null, 'JOB_CONFIRMED', 'CONFIRMED', jsonb_build_object('schedule_version_id', schedule_id));

  return new;
end;
$$;

create or replace function public.respond_job_reschedule(
  target_request_id uuid,
  response_action text
)
returns public.reschedule_request_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_request public.job_reschedule_requests%rowtype;
  target_job public.jobs%rowtype;
  normalized_action text := upper(btrim(response_action));
  new_version integer;
  new_schedule_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into target_request from public.job_reschedule_requests where id = target_request_id for update;
  if target_request.id is null then raise exception using errcode = 'P0002', message = 'reschedule request not found'; end if;
  select * into target_job from public.jobs where id = target_request.job_id for update;
  if caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;
  if target_request.status <> 'OPEN' then return target_request.status; end if;
  if caller_id = target_request.requested_by_user_id then
    raise exception using errcode = '42501', message = 'requester cannot respond to their own reschedule';
  end if;
  if target_job.status <> 'CONFIRMED' then
    raise exception using errcode = '42501', message = 'job is no longer reschedulable';
  end if;

  if normalized_action = 'REJECT' then
    update public.job_reschedule_requests
    set status = 'REJECTED', responded_by_user_id = caller_id, responded_at = event_time
    where id = target_request_id;
    insert into public.job_events (job_id, actor_user_id, event_type, metadata)
    values (target_job.id, caller_id, 'RESCHEDULE_REJECTED', jsonb_build_object('request_id', target_request_id));
    return 'REJECTED';
  elsif normalized_action <> 'ACCEPT' then
    raise exception using errcode = '22023', message = 'invalid reschedule response';
  end if;

  if target_request.schedule_type = 'FIXED_SLOT' then
    perform pg_advisory_xact_lock(hashtextextended(target_job.provider_user_id::text, 0));

    update public.provider_slot_holds
    set released_at = event_time,
        updated_at = event_time
    where provider_user_id = target_job.provider_user_id
      and released_at is null
      and expires_at <= event_time;

    if not public.provider_slot_is_available_internal(
      target_job.provider_user_id,
      target_request.starts_at,
      target_request.ends_at,
      null,
      target_job.id
    ) then
      raise exception using errcode = '23P01', message = 'requested reschedule slot is no longer available';
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1 into new_version
  from public.job_schedule_versions where job_id = target_job.id;

  insert into public.job_schedule_versions (
    job_id, version_number, schedule_type, starts_at, ends_at, deadline_at,
    expected_duration_minutes, authored_by_user_id, source
  ) values (
    target_job.id, new_version, target_request.schedule_type, target_request.starts_at,
    target_request.ends_at, target_request.deadline_at,
    target_request.expected_duration_minutes, target_request.requested_by_user_id, 'RESCHEDULE'
  ) returning id into new_schedule_id;

  if target_request.schedule_type = 'FIXED_SLOT' then
    insert into public.provider_booking_slots (job_id, provider_user_id, starts_at, ends_at, is_active)
    values (target_job.id, target_job.provider_user_id, target_request.starts_at, target_request.ends_at, true)
    on conflict (job_id) do update
      set starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          is_active = true,
          updated_at = event_time;
  else
    update public.provider_booking_slots set is_active = false where job_id = target_job.id;
  end if;

  update public.jobs set current_schedule_version_id = new_schedule_id, updated_at = event_time
  where id = target_job.id;
  update public.job_reschedule_requests
  set status = 'ACCEPTED', responded_by_user_id = caller_id, responded_at = event_time
  where id = target_request_id;

  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job.id, caller_id, 'RESCHEDULE_ACCEPTED', jsonb_build_object('request_id', target_request_id, 'schedule_version_id', new_schedule_id));
  return 'ACCEPTED';
end;
$$;
