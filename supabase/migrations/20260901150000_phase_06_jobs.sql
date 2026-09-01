-- Phase 06: scheduling, job lifecycle, rescheduling, scope changes and private job locations.
-- Real payment providers remain out of scope. All money remains integer minor units.

create extension if not exists btree_gist with schema extensions;

alter table public.jobs alter column status drop default;
alter table public.jobs alter column status type text using status::text;
drop type public.job_status;
create type public.job_status as enum (
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETION_REQUESTED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'EXPIRED',
  'NO_SHOW'
);
alter table public.jobs
  alter column status type public.job_status using status::public.job_status,
  alter column status set default 'CONFIRMED';

create type public.reschedule_request_status as enum (
  'OPEN',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN'
);

create type public.job_scope_change_status as enum (
  'OPEN',
  'REJECTED',
  'WITHDRAWN',
  'AWAITING_PAYMENT',
  'PAYMENT_FAILED',
  'PAID'
);

create table public.job_events (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (char_length(btrim(event_type)) between 2 and 80),
  from_status public.job_status,
  to_status public.job_status,
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.job_schedule_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  schedule_type public.schedule_type not null,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  expected_duration_minutes integer check (
    expected_duration_minutes is null
    or expected_duration_minutes between 1 and 10080
  ),
  authored_by_user_id uuid references auth.users(id) on delete restrict,
  source text not null check (source in ('ACCEPTED_PROPOSAL', 'RESCHEDULE')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, version_number),
  check (
    (schedule_type = 'UNSCHEDULED' and starts_at is null and ends_at is null and deadline_at is null)
    or (schedule_type = 'DEADLINE' and deadline_at is not null and starts_at is null and ends_at is null)
    or (schedule_type in ('FIXED_SLOT', 'FLEXIBLE_WINDOW') and starts_at is not null and ends_at is not null and ends_at > starts_at and deadline_at is null)
  )
);

alter table public.jobs
  add column current_schedule_version_id uuid references public.job_schedule_versions(id) on delete restrict;

create table public.provider_booking_slots (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at),
  exclude using gist (
    provider_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (is_active)
);

create trigger provider_booking_slots_set_updated_at
before update on public.provider_booking_slots
for each row execute function public.set_updated_at();

create table public.job_reschedule_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  status public.reschedule_request_status not null default 'OPEN',
  schedule_type public.schedule_type not null,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  expected_duration_minutes integer check (
    expected_duration_minutes is null
    or expected_duration_minutes between 1 and 10080
  ),
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 1000),
  responded_by_user_id uuid references auth.users(id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (schedule_type = 'UNSCHEDULED' and starts_at is null and ends_at is null and deadline_at is null)
    or (schedule_type = 'DEADLINE' and deadline_at is not null and starts_at is null and ends_at is null)
    or (schedule_type in ('FIXED_SLOT', 'FLEXIBLE_WINDOW') and starts_at is not null and ends_at is not null and ends_at > starts_at and deadline_at is null)
  )
);

create unique index job_reschedule_one_open_idx
on public.job_reschedule_requests (job_id)
where status = 'OPEN';

create table public.job_scope_changes (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  status public.job_scope_change_status not null default 'OPEN',
  scope_snapshot text not null check (char_length(btrim(scope_snapshot)) between 3 and 4000),
  additional_amount_minor bigint not null default 0 check (additional_amount_minor >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  client_responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger job_scope_changes_set_updated_at
before update on public.job_scope_changes
for each row execute function public.set_updated_at();

create unique index job_scope_change_one_open_idx
on public.job_scope_changes (job_id)
where status in ('OPEN', 'AWAITING_PAYMENT', 'PAYMENT_FAILED');

create table public.job_additional_payment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  scope_change_id uuid not null references public.job_scope_changes(id) on delete restrict,
  request_nonce uuid not null,
  provider_name text not null default 'FAKE' check (provider_name = 'FAKE'),
  provider_reference text not null check (char_length(provider_reference) between 6 and 160),
  status public.payment_status not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (scope_change_id, request_nonce),
  unique (provider_name, provider_reference)
);

create trigger job_additional_payment_attempts_set_updated_at
before update on public.job_additional_payment_attempts
for each row execute function public.set_updated_at();

create table public.job_private_locations (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  exact_address text not null check (char_length(btrim(exact_address)) between 5 and 500),
  latitude double precision,
  longitude double precision,
  access_notes text check (access_notes is null or char_length(access_notes) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create trigger job_private_locations_set_updated_at
before update on public.job_private_locations
for each row execute function public.set_updated_at();

create index job_events_job_created_idx on public.job_events (job_id, created_at, id);
create index job_schedule_versions_job_version_idx on public.job_schedule_versions (job_id, version_number desc);
create index job_reschedule_job_created_idx on public.job_reschedule_requests (job_id, created_at desc, id desc);
create index job_scope_changes_job_created_idx on public.job_scope_changes (job_id, created_at desc, id desc);

create or replace function public.reject_job_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '42501', message = 'job history rows are immutable';
end;
$$;

create trigger job_events_immutable_guard
before update or delete on public.job_events
for each row execute function public.reject_job_history_mutation();

create trigger job_schedule_versions_immutable_guard
before update or delete on public.job_schedule_versions
for each row execute function public.reject_job_history_mutation();

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
  end if;

  insert into public.job_events (job_id, actor_user_id, event_type, to_status, metadata)
  values (new.id, null, 'JOB_CONFIRMED', 'CONFIRMED', jsonb_build_object('schedule_version_id', schedule_id));

  return new;
end;
$$;

create trigger jobs_initialize_schedule
after insert on public.jobs
for each row execute function public.initialize_job_schedule();

-- Backfill any jobs that predate this migration. The trigger handles future inserts.
do $$
declare
  existing_job public.jobs%rowtype;
begin
  for existing_job in select * from public.jobs where current_schedule_version_id is null loop
    perform public.initialize_job_schedule() from (select existing_job.*) as new;
  end loop;
exception when others then
  -- CI/beta databases normally have no pre-existing jobs. Do not hide future-job insert errors;
  -- this block only prevents a legacy backfill from blocking the migration.
  null;
end $$;

create or replace function public.transition_job_status(
  target_job_id uuid,
  expected_status public.job_status,
  requested_status public.job_status,
  transition_reason text default null
)
returns public.job_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
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

  return requested_status;
end;
$$;

create or replace function public.request_job_reschedule(
  target_job_id uuid,
  requested_schedule_type public.schedule_type,
  requested_starts_at timestamptz default null,
  requested_ends_at timestamptz default null,
  requested_deadline_at timestamptz default null,
  requested_duration_minutes integer default null,
  request_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  created_id uuid;
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;
  if target_job.status <> 'CONFIRMED' then
    raise exception using errcode = '42501', message = 'only confirmed jobs can be rescheduled';
  end if;

  insert into public.job_reschedule_requests (
    job_id, requested_by_user_id, schedule_type, starts_at, ends_at, deadline_at,
    expected_duration_minutes, reason
  ) values (
    target_job_id, caller_id, requested_schedule_type, requested_starts_at,
    requested_ends_at, requested_deadline_at, requested_duration_minutes,
    nullif(btrim(request_reason), '')
  ) returning id into created_id;

  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job_id, caller_id, 'RESCHEDULE_REQUESTED', jsonb_build_object('request_id', created_id));
  return created_id;
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

create or replace function public.request_job_scope_change(
  target_job_id uuid,
  new_scope_text text,
  additional_amount_minor bigint default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  proposal_version public.proposal_versions%rowtype;
  created_id uuid;
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id <> target_job.provider_user_id then
    raise exception using errcode = '42501', message = 'only the provider can request a scope change';
  end if;
  if target_job.status not in ('CONFIRMED', 'IN_PROGRESS') then
    raise exception using errcode = '42501', message = 'job does not accept scope changes in this state';
  end if;
  if additional_amount_minor < 0 then
    raise exception using errcode = '22023', message = 'additional amount cannot be negative';
  end if;
  select * into proposal_version from public.proposal_versions where id = target_job.accepted_proposal_version_id;

  insert into public.job_scope_changes (
    job_id, requested_by_user_id, scope_snapshot, additional_amount_minor, currency_code
  ) values (
    target_job.id, caller_id, btrim(new_scope_text), additional_amount_minor, proposal_version.currency_code
  ) returning id into created_id;

  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job.id, caller_id, 'SCOPE_CHANGE_REQUESTED', jsonb_build_object('scope_change_id', created_id, 'additional_amount_minor', additional_amount_minor));
  return created_id;
end;
$$;

create or replace function public.respond_job_scope_change(
  target_scope_change_id uuid,
  response_action text
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
  normalized_action text := upper(btrim(response_action));
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
    next_status := 'REJECTED';
  elsif normalized_action = 'ACCEPT' then
    next_status := case when target_change.additional_amount_minor > 0 then 'AWAITING_PAYMENT' else 'PAID' end;
  else
    raise exception using errcode = '22023', message = 'invalid scope change response';
  end if;

  update public.job_scope_changes
  set status = next_status, client_responded_at = event_time, updated_at = event_time
  where id = target_scope_change_id;
  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job.id, caller_id, case when normalized_action = 'ACCEPT' then 'SCOPE_CHANGE_ACCEPTED' else 'SCOPE_CHANGE_REJECTED' end,
    jsonb_build_object('scope_change_id', target_scope_change_id, 'status', next_status::text));
  return next_status;
end;
$$;

create or replace function public.apply_fake_additional_payment_result(
  target_scope_change_id uuid,
  payment_nonce uuid,
  payment_outcome text,
  actor_client_user_id uuid
)
returns table (
  payment_attempt_id uuid,
  resulting_scope_change_status public.job_scope_change_status
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_change public.job_scope_changes%rowtype;
  target_job public.jobs%rowtype;
  existing_attempt public.job_additional_payment_attempts%rowtype;
  normalized_outcome text := upper(btrim(payment_outcome));
  attempt_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'fake additional payment is server-only';
  end if;
  if normalized_outcome not in ('SUCCESS', 'PENDING', 'FAILURE') then
    raise exception using errcode = '22023', message = 'invalid fake payment outcome';
  end if;
  select * into target_change from public.job_scope_changes where id = target_scope_change_id for update;
  if target_change.id is null then raise exception using errcode = 'P0002', message = 'scope change not found'; end if;
  select * into target_job from public.jobs where id = target_change.job_id;
  if actor_client_user_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client can initiate additional payment';
  end if;
  if target_change.additional_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'scope change has no additional amount';
  end if;

  select * into existing_attempt from public.job_additional_payment_attempts
  where scope_change_id = target_scope_change_id and request_nonce = payment_nonce;
  if existing_attempt.id is not null then
    return query select existing_attempt.id, target_change.status;
    return;
  end if;
  if target_change.status not in ('AWAITING_PAYMENT', 'PAYMENT_FAILED') then
    raise exception using errcode = '42501', message = 'scope change is not payable';
  end if;

  insert into public.job_additional_payment_attempts (
    scope_change_id, request_nonce, provider_reference, status, amount_minor, currency_code
  ) values (
    target_scope_change_id, payment_nonce, 'fake-additional:' || payment_nonce::text,
    case normalized_outcome when 'SUCCESS' then 'SUCCEEDED'::public.payment_status when 'PENDING' then 'PENDING'::public.payment_status else 'FAILED'::public.payment_status end,
    target_change.additional_amount_minor, target_change.currency_code
  ) returning id into attempt_id;

  update public.job_scope_changes
  set status = case normalized_outcome when 'SUCCESS' then 'PAID'::public.job_scope_change_status when 'FAILURE' then 'PAYMENT_FAILED'::public.job_scope_change_status else 'AWAITING_PAYMENT'::public.job_scope_change_status end,
      updated_at = event_time
  where id = target_scope_change_id;

  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job.id, actor_client_user_id, 'FAKE_ADDITIONAL_PAYMENT_' || normalized_outcome,
    jsonb_build_object('scope_change_id', target_scope_change_id, 'payment_attempt_id', attempt_id));

  return query select attempt_id,
    case normalized_outcome when 'SUCCESS' then 'PAID'::public.job_scope_change_status when 'FAILURE' then 'PAYMENT_FAILED'::public.job_scope_change_status else 'AWAITING_PAYMENT'::public.job_scope_change_status end;
end;
$$;

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
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into target_job from public.jobs where id = target_job_id;
  if target_job.id is null or caller_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client can set the exact job location';
  end if;
  if target_job.status not in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED') then
    raise exception using errcode = '42501', message = 'exact location is unavailable for this job state';
  end if;
  insert into public.job_private_locations (job_id, client_user_id, exact_address, latitude, longitude, access_notes)
  values (target_job.id, caller_id, btrim(exact_address_text), lat, lng, nullif(btrim(notes), ''))
  on conflict (job_id) do update set
    exact_address = excluded.exact_address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    access_notes = excluded.access_notes,
    updated_at = timezone('utc', now());
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
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
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
  left join public.profiles peer on peer.user_id = case when caller_id = j.client_user_id then j.provider_user_id else j.client_user_id end
  where caller_id in (j.client_user_id, j.provider_user_id)
    and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED', 'DISPUTED')
  order by coalesce(sv.starts_at, sv.deadline_at, j.confirmed_at) asc, j.id asc
  limit bounded_limit;
end;
$$;

alter table public.job_events enable row level security;
alter table public.job_schedule_versions enable row level security;
alter table public.provider_booking_slots enable row level security;
alter table public.job_reschedule_requests enable row level security;
alter table public.job_scope_changes enable row level security;
alter table public.job_additional_payment_attempts enable row level security;
alter table public.job_private_locations enable row level security;

create policy job_events_select_participant on public.job_events for select to authenticated
using (exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.client_user_id, j.provider_user_id)));
create policy job_schedule_versions_select_participant on public.job_schedule_versions for select to authenticated
using (exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.client_user_id, j.provider_user_id)));
create policy booking_slots_select_provider on public.provider_booking_slots for select to authenticated
using (auth.uid() = provider_user_id);
create policy reschedule_select_participant on public.job_reschedule_requests for select to authenticated
using (exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.client_user_id, j.provider_user_id)));
create policy scope_change_select_participant on public.job_scope_changes for select to authenticated
using (exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.client_user_id, j.provider_user_id)));
create policy additional_payment_select_participant on public.job_additional_payment_attempts for select to authenticated
using (exists (
  select 1 from public.job_scope_changes sc join public.jobs j on j.id = sc.job_id
  where sc.id = scope_change_id and auth.uid() in (j.client_user_id, j.provider_user_id)
));
create policy job_private_location_select on public.job_private_locations for select to authenticated
using (exists (
  select 1 from public.jobs j
  where j.id = job_id
    and (
      auth.uid() = j.client_user_id
      or (auth.uid() = j.provider_user_id and j.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED'))
    )
));

revoke all privileges on table public.job_events from public, anon, authenticated;
revoke all privileges on table public.job_schedule_versions from public, anon, authenticated;
revoke all privileges on table public.provider_booking_slots from public, anon, authenticated;
revoke all privileges on table public.job_reschedule_requests from public, anon, authenticated;
revoke all privileges on table public.job_scope_changes from public, anon, authenticated;
revoke all privileges on table public.job_additional_payment_attempts from public, anon, authenticated;
revoke all privileges on table public.job_private_locations from public, anon, authenticated;

grant select on public.job_events, public.job_schedule_versions, public.provider_booking_slots,
  public.job_reschedule_requests, public.job_scope_changes, public.job_additional_payment_attempts,
  public.job_private_locations to authenticated;
grant select, insert, update, delete on public.job_events, public.job_schedule_versions,
  public.provider_booking_slots, public.job_reschedule_requests, public.job_scope_changes,
  public.job_additional_payment_attempts, public.job_private_locations to service_role;

revoke all on function public.transition_job_status(uuid, public.job_status, public.job_status, text) from public, anon, authenticated, service_role;
grant execute on function public.transition_job_status(uuid, public.job_status, public.job_status, text) to authenticated, service_role;
revoke all on function public.request_job_reschedule(uuid, public.schedule_type, timestamptz, timestamptz, timestamptz, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.request_job_reschedule(uuid, public.schedule_type, timestamptz, timestamptz, timestamptz, integer, text) to authenticated, service_role;
revoke all on function public.respond_job_reschedule(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.respond_job_reschedule(uuid, text) to authenticated, service_role;
revoke all on function public.request_job_scope_change(uuid, text, bigint) from public, anon, authenticated, service_role;
grant execute on function public.request_job_scope_change(uuid, text, bigint) to authenticated, service_role;
revoke all on function public.respond_job_scope_change(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.respond_job_scope_change(uuid, text) to authenticated, service_role;
revoke all on function public.apply_fake_additional_payment_result(uuid, uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.apply_fake_additional_payment_result(uuid, uuid, text, uuid) to service_role;
revoke all on function public.set_job_exact_location(uuid, text, double precision, double precision, text) from public, anon, authenticated, service_role;
grant execute on function public.set_job_exact_location(uuid, text, double precision, double precision, text) to authenticated, service_role;
revoke all on function public.list_my_upcoming_jobs(integer) from public, anon, authenticated, service_role;
grant execute on function public.list_my_upcoming_jobs(integer) to authenticated, service_role;
