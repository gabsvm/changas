-- Phase 06: recurring availability, exception blocks and temporary payment slot holds.
-- Phase 02 created availability_rules/availability_blocks as provider-owned data.
-- Phase 06 makes scheduling mutations RPC-authoritative and adds payment-window holds.

-- Keep provider scheduling internals private and route mutations through audited RPCs.
revoke insert, update, delete on table public.availability_rules from authenticated;
revoke insert, update, delete on table public.availability_blocks from authenticated;

create table public.provider_slot_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  accepted_proposal_version_id uuid not null references public.proposal_versions(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  request_nonce uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (provider_user_id <> client_user_id),
  check (ends_at > starts_at),
  check (expires_at > created_at),
  unique (proposal_id, request_nonce)
);

create index provider_slot_holds_provider_window_idx
on public.provider_slot_holds (provider_user_id, starts_at, ends_at, expires_at)
where released_at is null;

create index provider_slot_holds_proposal_idx
on public.provider_slot_holds (proposal_id, created_at desc);

create trigger provider_slot_holds_set_updated_at
before update on public.provider_slot_holds
for each row execute function public.set_updated_at();

alter table public.provider_slot_holds enable row level security;

create policy provider_slot_holds_select_participant
on public.provider_slot_holds for select to authenticated
using (auth.uid() in (client_user_id, provider_user_id));

revoke all privileges on table public.provider_slot_holds from public, anon, authenticated;
grant select on table public.provider_slot_holds to authenticated;
grant select, insert, update, delete on table public.provider_slot_holds to service_role;

create or replace function public.provider_slot_is_available(
  target_provider_user_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  excluded_hold_id uuid default null
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

  -- Providers without active rules retain the legacy "unrestricted except blocks/bookings"
  -- behavior until they explicitly configure availability.
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

revoke all on function public.provider_slot_is_available(uuid, timestamptz, timestamptz, uuid)
from public, anon, authenticated, service_role;

create or replace function public.upsert_provider_availability_rule(
  target_rule_id uuid,
  requested_weekday smallint,
  requested_start_time time,
  requested_end_time time,
  requested_timezone text,
  requested_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  result_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if not exists (
    select 1 from public.provider_profiles pp where pp.user_id = caller_id
  ) then
    raise exception using errcode = '42501', message = 'provider profile required';
  end if;
  if requested_weekday not between 0 and 6 then
    raise exception using errcode = '22023', message = 'weekday must be between 0 and 6';
  end if;
  if requested_start_time is null or requested_end_time is null or requested_end_time <= requested_start_time then
    raise exception using errcode = '22023', message = 'availability time range is invalid';
  end if;
  if requested_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = btrim(requested_timezone)
  ) then
    raise exception using errcode = '22023', message = 'availability timezone is invalid';
  end if;

  if target_rule_id is null then
    insert into public.availability_rules (
      provider_user_id, weekday, start_time, end_time, timezone, is_active
    ) values (
      caller_id,
      requested_weekday,
      requested_start_time,
      requested_end_time,
      btrim(requested_timezone),
      coalesce(requested_is_active, true)
    ) returning id into result_id;
  else
    update public.availability_rules
    set weekday = requested_weekday,
        start_time = requested_start_time,
        end_time = requested_end_time,
        timezone = btrim(requested_timezone),
        is_active = coalesce(requested_is_active, true),
        updated_at = timezone('utc', now())
    where id = target_rule_id
      and provider_user_id = caller_id
    returning id into result_id;

    if result_id is null then
      raise exception using errcode = '42501', message = 'availability rule access denied';
    end if;
  end if;

  return result_id;
end;
$$;

create or replace function public.delete_provider_availability_rule(target_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  delete from public.availability_rules
  where id = target_rule_id
    and provider_user_id = caller_id;

  if not found then
    raise exception using errcode = '42501', message = 'availability rule access denied';
  end if;
end;
$$;

create or replace function public.create_provider_availability_block(
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  result_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if not exists (
    select 1 from public.provider_profiles pp where pp.user_id = caller_id
  ) then
    raise exception using errcode = '42501', message = 'provider profile required';
  end if;
  if requested_starts_at is null or requested_ends_at is null or requested_ends_at <= requested_starts_at then
    raise exception using errcode = '22023', message = 'availability block range is invalid';
  end if;
  if requested_reason is not null and char_length(btrim(requested_reason)) > 240 then
    raise exception using errcode = '22023', message = 'availability block reason is too long';
  end if;

  insert into public.availability_blocks (
    provider_user_id, starts_at, ends_at, reason
  ) values (
    caller_id,
    requested_starts_at,
    requested_ends_at,
    nullif(btrim(requested_reason), '')
  ) returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.delete_provider_availability_block(target_block_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  delete from public.availability_blocks
  where id = target_block_id
    and provider_user_id = caller_id;

  if not found then
    raise exception using errcode = '42501', message = 'availability block access denied';
  end if;
end;
$$;

create or replace function public.hold_proposal_slot(
  target_proposal_id uuid,
  hold_nonce uuid,
  ttl_seconds integer default 600
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_proposal public.proposals%rowtype;
  accepted_version public.proposal_versions%rowtype;
  existing_hold public.provider_slot_holds%rowtype;
  result_id uuid;
  now_at timestamptz := timezone('utc', now());
  effective_ttl integer := greatest(60, least(coalesce(ttl_seconds, 600), 1800));
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if hold_nonce is null then
    raise exception using errcode = '22023', message = 'hold nonce is required';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null or target_proposal.client_user_id <> caller_id then
    raise exception using errcode = '42501', message = 'proposal slot hold access denied';
  end if;
  if target_proposal.status not in ('AWAITING_PAYMENT', 'PAYMENT_FAILED')
     or target_proposal.accepted_version_id is null then
    raise exception using errcode = '22023', message = 'proposal is not awaiting payment';
  end if;

  select * into accepted_version
  from public.proposal_versions
  where id = target_proposal.accepted_version_id;

  if accepted_version.id is null
     or accepted_version.schedule_type <> 'FIXED_SLOT'
     or accepted_version.schedule_start_at is null
     or accepted_version.schedule_end_at is null then
    raise exception using errcode = '22023', message = 'proposal does not contain a fixed slot';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_proposal.provider_user_id::text, 0));

  update public.provider_slot_holds
  set released_at = now_at,
      updated_at = now_at
  where provider_user_id = target_proposal.provider_user_id
    and released_at is null
    and expires_at <= now_at;

  select * into existing_hold
  from public.provider_slot_holds
  where proposal_id = target_proposal.id
    and request_nonce = hold_nonce
  for update;

  if existing_hold.id is not null
     and existing_hold.released_at is null
     and existing_hold.expires_at > now_at then
    return existing_hold.id;
  end if;

  if not public.provider_slot_is_available(
    target_proposal.provider_user_id,
    accepted_version.schedule_start_at,
    accepted_version.schedule_end_at,
    case when existing_hold.id is null then null else existing_hold.id end
  ) then
    raise exception using errcode = '23P01', message = 'requested slot is not available';
  end if;

  update public.provider_slot_holds
  set released_at = now_at,
      updated_at = now_at
  where proposal_id = target_proposal.id
    and released_at is null
    and (existing_hold.id is null or id <> existing_hold.id);

  if existing_hold.id is null then
    insert into public.provider_slot_holds (
      proposal_id,
      accepted_proposal_version_id,
      provider_user_id,
      client_user_id,
      request_nonce,
      starts_at,
      ends_at,
      expires_at
    ) values (
      target_proposal.id,
      accepted_version.id,
      target_proposal.provider_user_id,
      target_proposal.client_user_id,
      hold_nonce,
      accepted_version.schedule_start_at,
      accepted_version.schedule_end_at,
      now_at + make_interval(secs => effective_ttl)
    ) returning id into result_id;
  else
    update public.provider_slot_holds
    set accepted_proposal_version_id = accepted_version.id,
        provider_user_id = target_proposal.provider_user_id,
        client_user_id = target_proposal.client_user_id,
        starts_at = accepted_version.schedule_start_at,
        ends_at = accepted_version.schedule_end_at,
        expires_at = now_at + make_interval(secs => effective_ttl),
        released_at = null,
        updated_at = now_at
    where id = existing_hold.id
    returning id into result_id;
  end if;

  insert into public.proposal_events (
    proposal_id, proposal_version_id, actor_user_id, event_type, metadata
  ) values (
    target_proposal.id,
    accepted_version.id,
    caller_id,
    'PAYMENT_SLOT_HELD',
    jsonb_build_object('slot_hold_id', result_id, 'expires_at', now_at + make_interval(secs => effective_ttl))
  );

  return result_id;
end;
$$;

create or replace function public.release_proposal_slot_hold(
  target_proposal_id uuid,
  hold_nonce uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_proposal public.proposals%rowtype;
  target_hold public.provider_slot_holds%rowtype;
  now_at timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id;

  if target_proposal.id is null or target_proposal.client_user_id <> caller_id then
    raise exception using errcode = '42501', message = 'proposal slot hold access denied';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_proposal.provider_user_id::text, 0));

  select * into target_hold
  from public.provider_slot_holds
  where proposal_id = target_proposal_id
    and request_nonce = hold_nonce
  for update;

  if target_hold.id is null then
    return;
  end if;

  if target_hold.released_at is null then
    update public.provider_slot_holds
    set released_at = now_at,
        updated_at = now_at
    where id = target_hold.id;

    insert into public.proposal_events (
      proposal_id, proposal_version_id, actor_user_id, event_type, metadata
    ) values (
      target_proposal.id,
      target_hold.accepted_proposal_version_id,
      caller_id,
      'PAYMENT_SLOT_RELEASED',
      jsonb_build_object('slot_hold_id', target_hold.id)
    );
  end if;
end;
$$;

revoke all on function public.upsert_provider_availability_rule(uuid, smallint, time, time, text, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.delete_provider_availability_rule(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.create_provider_availability_block(timestamptz, timestamptz, text)
from public, anon, authenticated, service_role;
revoke all on function public.delete_provider_availability_block(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.hold_proposal_slot(uuid, uuid, integer)
from public, anon, authenticated, service_role;
revoke all on function public.release_proposal_slot_hold(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.upsert_provider_availability_rule(uuid, smallint, time, time, text, boolean)
to authenticated;
grant execute on function public.delete_provider_availability_rule(uuid)
to authenticated;
grant execute on function public.create_provider_availability_block(timestamptz, timestamptz, text)
to authenticated;
grant execute on function public.delete_provider_availability_block(uuid)
to authenticated;
grant execute on function public.hold_proposal_slot(uuid, uuid, integer)
to authenticated;
grant execute on function public.release_proposal_slot_hold(uuid, uuid)
to authenticated;
