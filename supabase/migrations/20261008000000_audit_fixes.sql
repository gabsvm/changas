-- Audit fixes: re-runnable, dependency-safe. Applies cleanly on fresh and
-- existing databases. Uses CREATE OR REPLACE / IF EXISTS only; no live
-- function is dropped (only the jobs_initialize_schedule trigger is
-- recreated). Does not touch search_discovery_services_v4.

-- 1) handle_new_user: idempotent reinserts (auth hook can retry).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    case
      when char_length(
        coalesce(
          nullif(new.raw_user_meta_data ->> 'display_name', ''),
          nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
          'Usuario'
        )
      ) between 2 and 80 then coalesce(
        nullif(new.raw_user_meta_data ->> 'display_name', ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      )
      else 'Usuario'
    end
  )
  on conflict (id) do nothing;

  insert into public.profile_private (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.user_roles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) search_discovery_services_v2: kept (search_discovery_services_v3
-- delegates into it internally), so restore explicit API grants instead of
-- dropping it. No app caller uses v2 directly; v4 is untouched.
grant execute on function public.search_discovery_services_v2(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) to anon, authenticated, service_role;

-- 3) Fixed search_path on every mutable SECURITY DEFINER function plus the
-- shared updated_at trigger.
alter function private.activate_provider_for_test(uuid)
  set search_path = pg_catalog, public;
alter function public.is_public_portfolio_media(text)
  set search_path = pg_catalog, public;
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

-- 4) guard_provider_status_change: server-side roles keep working, human
-- callers need the admin role. current_user alone is not trustworthy.
create or replace function public.guard_provider_status_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and current_user not in ('postgres', 'service_role')
     and (auth.uid() is null or not public.is_current_user_admin()) then
    raise exception 'provider status is server-authoritative'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 5) Messages need a full row image for realtime / logical decoding.
alter table public.messages replica identity full;

-- 6) initialize_job_schedule as BEFORE INSERT assigning NEW instead of a
-- self-update from an AFTER trigger. Child rows reference the new job row,
-- so the covering foreign keys are deferred (catalog-only change, no data
-- rewrite). No backfill handler is re-added here on purpose.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'job_schedule_versions_job_id_fkey'
      and connamespace = 'public'::regnamespace
      and not condeferrable
  ) then
    alter table public.job_schedule_versions
      alter constraint job_schedule_versions_job_id_fkey
      deferrable initially deferred;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'provider_booking_slots_job_id_fkey'
      and connamespace = 'public'::regnamespace
      and not condeferrable
  ) then
    alter table public.provider_booking_slots
      alter constraint provider_booking_slots_job_id_fkey
      deferrable initially deferred;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'job_events_job_id_fkey'
      and connamespace = 'public'::regnamespace
      and not condeferrable
  ) then
    alter table public.job_events
      alter constraint job_events_job_id_fkey
      deferrable initially deferred;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'jobs_current_schedule_version_id_fkey'
      and connamespace = 'public'::regnamespace
      and not condeferrable
  ) then
    alter table public.jobs
      alter constraint jobs_current_schedule_version_id_fkey
      deferrable initially deferred;
  end if;
end
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
  schedule_id uuid := extensions.gen_random_uuid();
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
    id,
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
    schedule_id,
    new.id,
    1,
    effective_type,
    case when effective_type in ('FIXED_SLOT', 'FLEXIBLE_WINDOW') then proposal_version.schedule_start_at end,
    case when effective_type in ('FIXED_SLOT', 'FLEXIBLE_WINDOW') then proposal_version.schedule_end_at end,
    case when effective_type = 'DEADLINE' then proposal_version.deadline_at end,
    proposal_version.expected_duration_minutes,
    proposal_version.authored_by_user_id,
    'ACCEPTED_PROPOSAL'
  );

  new.current_schedule_version_id := schedule_id;

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

drop trigger if exists jobs_initialize_schedule on public.jobs;
create trigger jobs_initialize_schedule
before insert on public.jobs
for each row execute function public.initialize_job_schedule();

-- 7) transition_job_status: no SYSTEM chatter into blocked or closed chats.
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

-- 8) Batched inbox lookup: one row per conversation with an OPEN proposal.
create or replace function public.list_inbox_open_deals(
  target_conversation_ids uuid[]
)
returns table (
  conversation_id uuid,
  price_amount bigint,
  currency_code text
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

  if target_conversation_ids is null or cardinality(target_conversation_ids) = 0 then
    return;
  end if;

  if cardinality(target_conversation_ids) > 100 then
    raise exception using errcode = '22023', message = 'too many conversations requested';
  end if;

  return query
  select distinct on (p.conversation_id)
    p.conversation_id,
    v.price_amount,
    v.currency_code
  from public.proposals p
  join public.proposal_versions v on v.id = p.current_version_id
  join public.conversations c on c.id = p.conversation_id
  where p.conversation_id = any(target_conversation_ids)
    and p.status = 'OPEN'
    and caller_id in (c.client_user_id, c.provider_user_id)
  order by p.conversation_id, p.created_at asc, p.id asc;
end;
$$;

revoke all on function public.list_inbox_open_deals(uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.list_inbox_open_deals(uuid[])
to authenticated, service_role;
