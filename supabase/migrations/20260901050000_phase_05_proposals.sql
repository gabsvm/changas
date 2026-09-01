-- Phase 05: structured proposals, immutable economic snapshots and fake payments.
-- Real payment providers and the full job lifecycle remain out of scope.

create type public.proposal_kind as enum (
  'DIRECT_BOOKING',
  'QUOTE_REQUEST',
  'PROVIDER_QUOTE',
  'CLIENT_OFFER',
  'COUNTEROFFER'
);

create type public.proposal_status as enum (
  'OPEN',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'AWAITING_PAYMENT',
  'PAYMENT_FAILED',
  'PAID'
);

create type public.payment_status as enum (
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED'
);

create type public.job_status as enum ('CONFIRMED');

create table public.proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  kind public.proposal_kind not null,
  status public.proposal_status not null default 'OPEN',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  current_version_id uuid,
  accepted_version_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (client_user_id <> provider_user_id),
  check (created_by_user_id in (client_user_id, provider_user_id))
);

create table public.proposal_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  kind public.proposal_kind not null,
  authored_by_user_id uuid not null references auth.users(id) on delete restrict,
  service_title_snapshot text not null check (char_length(btrim(service_title_snapshot)) between 3 and 120),
  service_description_snapshot text not null check (char_length(btrim(service_description_snapshot)) between 20 and 3000),
  modality public.service_modality not null,
  scope_snapshot text not null check (char_length(btrim(scope_snapshot)) between 3 and 4000),
  price_model_snapshot public.price_model not null,
  price_amount bigint check (price_amount is null or price_amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  schedule_type public.schedule_type not null,
  schedule_start_at timestamptz,
  schedule_end_at timestamptz,
  deadline_at timestamptz,
  expected_duration_minutes integer check (
    expected_duration_minutes is null
    or expected_duration_minutes between 1 and 10080
  ),
  includes_snapshot text check (
    includes_snapshot is null or char_length(includes_snapshot) <= 1500
  ),
  materials_notes_snapshot text check (
    materials_notes_snapshot is null
    or char_length(materials_notes_snapshot) <= 1500
  ),
  created_at timestamptz not null default timezone('utc', now()),
  unique (proposal_id, version_number),
  check (schedule_end_at is null or schedule_start_at is null or schedule_end_at > schedule_start_at),
  check (
    (kind = 'QUOTE_REQUEST' and price_amount is null)
    or (kind <> 'QUOTE_REQUEST' and price_amount is not null)
  )
);

alter table public.proposals
  add constraint proposals_current_version_fk
  foreign key (current_version_id)
  references public.proposal_versions(id)
  on delete restrict,
  add constraint proposals_accepted_version_fk
  foreign key (accepted_version_id)
  references public.proposal_versions(id)
  on delete restrict;

create table public.proposal_events (
  id uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  proposal_version_id uuid references public.proposal_versions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (char_length(btrim(event_type)) between 2 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.payment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  accepted_proposal_version_id uuid not null references public.proposal_versions(id) on delete restrict,
  request_nonce uuid not null,
  provider_name text not null default 'FAKE' check (provider_name = 'FAKE'),
  provider_reference text not null check (char_length(provider_reference) between 6 and 160),
  status public.payment_status not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (proposal_id, request_nonce),
  unique (provider_name, provider_reference)
);

create table public.jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_proposal_version_id uuid not null unique references public.proposal_versions(id) on delete restrict,
  payment_attempt_id uuid not null unique references public.payment_attempts(id) on delete restrict,
  status public.job_status not null default 'CONFIRMED',
  confirmed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (client_user_id <> provider_user_id)
);

create index proposals_conversation_created_idx
on public.proposals (conversation_id, created_at desc, id desc);
create index proposal_versions_proposal_version_idx
on public.proposal_versions (proposal_id, version_number desc);
create index proposal_events_proposal_created_idx
on public.proposal_events (proposal_id, created_at desc, id desc);
create index payment_attempts_proposal_created_idx
on public.payment_attempts (proposal_id, created_at desc, id desc);
create index jobs_client_created_idx
on public.jobs (client_user_id, created_at desc, id desc);
create index jobs_provider_created_idx
on public.jobs (provider_user_id, created_at desc, id desc);

create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();
create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create or replace function public.reject_proposal_version_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '42501', message = 'proposal versions are immutable';
end;
$$;

create trigger proposal_versions_immutable_guard
before update or delete on public.proposal_versions
for each row execute function public.reject_proposal_version_mutation();

alter table public.proposals enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_events enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.jobs enable row level security;

create or replace function public.is_proposal_participant(target_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.proposals p
    where p.id = target_proposal_id
      and auth.uid() in (p.client_user_id, p.provider_user_id)
  );
$$;

revoke all on function public.is_proposal_participant(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_proposal_participant(uuid)
to authenticated, service_role;

create policy proposals_select_participant
on public.proposals for select to authenticated
using (auth.uid() in (client_user_id, provider_user_id));

create policy proposal_versions_select_participant
on public.proposal_versions for select to authenticated
using (public.is_proposal_participant(proposal_id));

create policy proposal_events_select_participant
on public.proposal_events for select to authenticated
using (public.is_proposal_participant(proposal_id));

create policy payment_attempts_select_participant
on public.payment_attempts for select to authenticated
using (public.is_proposal_participant(proposal_id));

create policy jobs_select_participant
on public.jobs for select to authenticated
using (auth.uid() in (client_user_id, provider_user_id));

revoke all privileges on table public.proposals from public, anon, authenticated;
revoke all privileges on table public.proposal_versions from public, anon, authenticated;
revoke all privileges on table public.proposal_events from public, anon, authenticated;
revoke all privileges on table public.payment_attempts from public, anon, authenticated;
revoke all privileges on table public.jobs from public, anon, authenticated;

grant select on table public.proposals to authenticated;
grant select on table public.proposal_versions to authenticated;
grant select on table public.proposal_events to authenticated;
grant select on table public.payment_attempts to authenticated;
grant select on table public.jobs to authenticated;

grant select, insert, update, delete on table public.proposals to service_role;
grant select, insert, update, delete on table public.proposal_versions to service_role;
grant select, insert, update, delete on table public.proposal_events to service_role;
grant select, insert, update, delete on table public.payment_attempts to service_role;
grant select, insert, update, delete on table public.jobs to service_role;

create or replace function public.create_conversation_proposal(
  target_conversation_id uuid,
  requested_kind public.proposal_kind,
  scope_text text default null,
  proposed_price_amount bigint default null,
  proposed_schedule_start_at timestamptz default null,
  proposed_schedule_end_at timestamptz default null,
  proposed_deadline_at timestamptz default null,
  proposal_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_service_id uuid;
  target_client_id uuid;
  target_provider_id uuid;
  service_title text;
  service_description text;
  service_modality public.service_modality;
  service_price_model public.price_model;
  service_price_amount bigint;
  service_currency text;
  service_accepts_offers boolean;
  service_schedule_type public.schedule_type;
  service_duration integer;
  service_includes text;
  service_materials text;
  effective_scope text;
  effective_price bigint;
  created_proposal_id uuid;
  created_version_id uuid;
  created_status public.proposal_status := 'OPEN';
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select
    c.service_id,
    c.client_user_id,
    c.provider_user_id,
    s.title,
    s.description,
    s.modality,
    s.price_model,
    s.price_amount,
    s.currency_code,
    s.accepts_offers,
    s.schedule_type,
    s.expected_duration_minutes,
    s.includes,
    s.materials_notes
  into
    target_service_id,
    target_client_id,
    target_provider_id,
    service_title,
    service_description,
    service_modality,
    service_price_model,
    service_price_amount,
    service_currency,
    service_accepts_offers,
    service_schedule_type,
    service_duration,
    service_includes,
    service_materials
  from public.conversations c
  join public.services s on s.id = c.service_id
  where c.id = target_conversation_id
    and caller_id in (c.client_user_id, c.provider_user_id)
  limit 1;

  if target_service_id is null then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  if proposal_expires_at is not null and proposal_expires_at <= event_time then
    raise exception using errcode = '22023', message = 'proposal expiry must be in the future';
  end if;

  if proposed_schedule_end_at is not null
    and proposed_schedule_start_at is not null
    and proposed_schedule_end_at <= proposed_schedule_start_at then
    raise exception using errcode = '22023', message = 'schedule end must be after start';
  end if;

  effective_scope := coalesce(nullif(btrim(scope_text), ''), service_description);
  if char_length(effective_scope) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'proposal scope is invalid';
  end if;

  case requested_kind
    when 'DIRECT_BOOKING' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can create a direct booking';
      end if;
      if service_price_model <> 'FIXED' or service_price_amount is null then
        raise exception using errcode = '22023', message = 'direct booking requires a fixed-price service';
      end if;
      effective_price := service_price_amount;
      created_status := 'AWAITING_PAYMENT';
    when 'QUOTE_REQUEST' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can request a quote';
      end if;
      if proposed_price_amount is not null then
        raise exception using errcode = '22023', message = 'quote requests cannot set a price';
      end if;
      effective_price := null;
    when 'CLIENT_OFFER' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can create a client offer';
      end if;
      if not service_accepts_offers then
        raise exception using errcode = '42501', message = 'this service does not accept offers';
      end if;
      if proposed_price_amount is null or proposed_price_amount <= 0 then
        raise exception using errcode = '22023', message = 'client offer requires a positive price';
      end if;
      effective_price := proposed_price_amount;
    when 'PROVIDER_QUOTE' then
      if caller_id <> target_provider_id then
        raise exception using errcode = '42501', message = 'only the provider can create a provider quote';
      end if;
      if proposed_price_amount is null or proposed_price_amount <= 0 then
        raise exception using errcode = '22023', message = 'provider quote requires a positive price';
      end if;
      effective_price := proposed_price_amount;
    when 'COUNTEROFFER' then
      raise exception using errcode = '22023', message = 'counteroffers require an existing proposal';
  end case;

  insert into public.proposals (
    conversation_id,
    service_id,
    client_user_id,
    provider_user_id,
    kind,
    status,
    created_by_user_id,
    expires_at,
    created_at,
    updated_at
  ) values (
    target_conversation_id,
    target_service_id,
    target_client_id,
    target_provider_id,
    requested_kind,
    created_status,
    caller_id,
    proposal_expires_at,
    event_time,
    event_time
  )
  returning id into created_proposal_id;

  insert into public.proposal_versions (
    proposal_id,
    version_number,
    kind,
    authored_by_user_id,
    service_title_snapshot,
    service_description_snapshot,
    modality,
    scope_snapshot,
    price_model_snapshot,
    price_amount,
    currency_code,
    schedule_type,
    schedule_start_at,
    schedule_end_at,
    deadline_at,
    expected_duration_minutes,
    includes_snapshot,
    materials_notes_snapshot,
    created_at
  ) values (
    created_proposal_id,
    1,
    requested_kind,
    caller_id,
    service_title,
    service_description,
    service_modality,
    effective_scope,
    service_price_model,
    effective_price,
    service_currency,
    service_schedule_type,
    proposed_schedule_start_at,
    proposed_schedule_end_at,
    proposed_deadline_at,
    service_duration,
    service_includes,
    service_materials,
    event_time
  )
  returning id into created_version_id;

  update public.proposals
  set current_version_id = created_version_id,
      accepted_version_id = case
        when requested_kind = 'DIRECT_BOOKING' then created_version_id
        else null
      end
  where id = created_proposal_id;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    created_proposal_id,
    created_version_id,
    caller_id,
    case when requested_kind = 'DIRECT_BOOKING' then 'DIRECT_BOOKING_CREATED' else 'PROPOSAL_CREATED' end,
    jsonb_build_object('kind', requested_kind::text, 'status', created_status::text),
    event_time
  );

  insert into public.messages (
    conversation_id,
    sender_user_id,
    kind,
    body,
    created_at
  ) values (
    target_conversation_id,
    null,
    'SYSTEM',
    case when requested_kind = 'DIRECT_BOOKING'
      then 'Reserva directa creada. Pendiente de pago.'
      else 'Se creó una propuesta estructurada.'
    end,
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_conversation_id;

  return created_proposal_id;
end;
$$;

revoke all on function public.create_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.create_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) to authenticated, service_role;

create or replace function public.revise_conversation_proposal(
  target_proposal_id uuid,
  requested_kind public.proposal_kind,
  scope_text text default null,
  proposed_price_amount bigint default null,
  proposed_schedule_start_at timestamptz default null,
  proposed_schedule_end_at timestamptz default null,
  proposed_deadline_at timestamptz default null,
  proposal_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_proposal public.proposals%rowtype;
  current_version public.proposal_versions%rowtype;
  service_row public.services%rowtype;
  next_version_number integer;
  next_scope text;
  next_price bigint;
  created_version_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null
    or caller_id not in (target_proposal.client_user_id, target_proposal.provider_user_id) then
    raise exception using errcode = '42501', message = 'proposal access denied';
  end if;

  if target_proposal.status <> 'OPEN' then
    raise exception using errcode = '42501', message = 'only open proposals can be revised';
  end if;

  if target_proposal.expires_at is not null and target_proposal.expires_at <= event_time then
    update public.proposals set status = 'EXPIRED' where id = target_proposal_id;
    insert into public.proposal_events (proposal_id, actor_user_id, event_type, created_at)
    values (target_proposal_id, null, 'PROPOSAL_EXPIRED', event_time);
    raise exception using errcode = '42501', message = 'proposal has expired';
  end if;

  select * into current_version
  from public.proposal_versions
  where id = target_proposal.current_version_id;

  select * into service_row
  from public.services
  where id = target_proposal.service_id;

  if caller_id = current_version.authored_by_user_id then
    if requested_kind <> current_version.kind then
      raise exception using errcode = '22023', message = 'author revisions must keep the proposal kind';
    end if;
  elsif caller_id = target_proposal.provider_user_id then
    if requested_kind not in ('PROVIDER_QUOTE', 'COUNTEROFFER') then
      raise exception using errcode = '22023', message = 'provider response must be a quote or counteroffer';
    end if;
  elsif caller_id = target_proposal.client_user_id then
    if requested_kind <> 'COUNTEROFFER' then
      raise exception using errcode = '22023', message = 'client response must be a counteroffer';
    end if;
  end if;

  if requested_kind = 'QUOTE_REQUEST' then
    if proposed_price_amount is not null then
      raise exception using errcode = '22023', message = 'quote requests cannot set a price';
    end if;
    next_price := null;
  else
    next_price := coalesce(proposed_price_amount, current_version.price_amount);
    if next_price is null or next_price <= 0 then
      raise exception using errcode = '22023', message = 'proposal revision requires a positive price';
    end if;
  end if;

  if proposed_schedule_end_at is not null
    and proposed_schedule_start_at is not null
    and proposed_schedule_end_at <= proposed_schedule_start_at then
    raise exception using errcode = '22023', message = 'schedule end must be after start';
  end if;

  next_scope := coalesce(nullif(btrim(scope_text), ''), current_version.scope_snapshot);
  if char_length(next_scope) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'proposal scope is invalid';
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version_number
  from public.proposal_versions
  where proposal_id = target_proposal_id;

  insert into public.proposal_versions (
    proposal_id,
    version_number,
    kind,
    authored_by_user_id,
    service_title_snapshot,
    service_description_snapshot,
    modality,
    scope_snapshot,
    price_model_snapshot,
    price_amount,
    currency_code,
    schedule_type,
    schedule_start_at,
    schedule_end_at,
    deadline_at,
    expected_duration_minutes,
    includes_snapshot,
    materials_notes_snapshot,
    created_at
  ) values (
    target_proposal_id,
    next_version_number,
    requested_kind,
    caller_id,
    service_row.title,
    service_row.description,
    service_row.modality,
    next_scope,
    service_row.price_model,
    next_price,
    service_row.currency_code,
    service_row.schedule_type,
    coalesce(proposed_schedule_start_at, current_version.schedule_start_at),
    coalesce(proposed_schedule_end_at, current_version.schedule_end_at),
    coalesce(proposed_deadline_at, current_version.deadline_at),
    service_row.expected_duration_minutes,
    service_row.includes,
    service_row.materials_notes,
    event_time
  )
  returning id into created_version_id;

  update public.proposals
  set current_version_id = created_version_id,
      kind = requested_kind,
      expires_at = coalesce(proposal_expires_at, expires_at),
      updated_at = event_time
  where id = target_proposal_id;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_proposal_id,
    created_version_id,
    caller_id,
    'PROPOSAL_REVISED',
    jsonb_build_object('kind', requested_kind::text, 'version', next_version_number),
    event_time
  );

  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_proposal.conversation_id,
    null,
    'SYSTEM',
    'La propuesta fue actualizada.',
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return created_version_id;
end;
$$;

revoke all on function public.revise_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.revise_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) to authenticated, service_role;

create or replace function public.respond_to_proposal(
  target_proposal_id uuid,
  response_action text
)
returns public.proposal_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_proposal public.proposals%rowtype;
  current_version public.proposal_versions%rowtype;
  normalized_action text := upper(btrim(response_action));
  next_status public.proposal_status;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null
    or caller_id not in (target_proposal.client_user_id, target_proposal.provider_user_id) then
    raise exception using errcode = '42501', message = 'proposal access denied';
  end if;

  if target_proposal.status <> 'OPEN' then
    return target_proposal.status;
  end if;

  if target_proposal.expires_at is not null and target_proposal.expires_at <= event_time then
    update public.proposals set status = 'EXPIRED' where id = target_proposal_id;
    insert into public.proposal_events (proposal_id, actor_user_id, event_type, created_at)
    values (target_proposal_id, null, 'PROPOSAL_EXPIRED', event_time);
    return 'EXPIRED';
  end if;

  select * into current_version
  from public.proposal_versions
  where id = target_proposal.current_version_id;

  case normalized_action
    when 'WITHDRAW' then
      if caller_id <> current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'only the current proposal author can withdraw it';
      end if;
      next_status := 'WITHDRAWN';
    when 'REJECT' then
      if caller_id = current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'proposal author cannot reject their own terms';
      end if;
      next_status := 'REJECTED';
    when 'ACCEPT' then
      if current_version.price_amount is null then
        raise exception using errcode = '22023', message = 'a priced proposal is required before acceptance';
      end if;
      if caller_id = current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'proposal author cannot accept their own terms';
      end if;
      if caller_id = target_proposal.client_user_id
        and current_version.authored_by_user_id <> target_proposal.provider_user_id then
        raise exception using errcode = '42501', message = 'client can only accept provider-authored terms';
      end if;
      if caller_id = target_proposal.provider_user_id
        and current_version.authored_by_user_id <> target_proposal.client_user_id then
        raise exception using errcode = '42501', message = 'provider can only accept client-authored terms';
      end if;
      next_status := 'AWAITING_PAYMENT';
    else
      raise exception using errcode = '22023', message = 'unknown proposal action';
  end case;

  update public.proposals
  set status = next_status,
      accepted_version_id = case
        when normalized_action = 'ACCEPT' then current_version.id
        else accepted_version_id
      end,
      updated_at = event_time
  where id = target_proposal_id;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_proposal_id,
    current_version.id,
    caller_id,
    case normalized_action
      when 'ACCEPT' then 'PROPOSAL_ACCEPTED'
      when 'REJECT' then 'PROPOSAL_REJECTED'
      else 'PROPOSAL_WITHDRAWN'
    end,
    jsonb_build_object('status', next_status::text),
    event_time
  );

  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_proposal.conversation_id,
    null,
    'SYSTEM',
    case normalized_action
      when 'ACCEPT' then 'Propuesta aceptada. Pendiente de pago.'
      when 'REJECT' then 'La propuesta fue rechazada.'
      else 'La propuesta fue retirada.'
    end,
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return next_status;
end;
$$;

revoke all on function public.respond_to_proposal(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_to_proposal(uuid, text)
to authenticated, service_role;

create or replace function public.apply_fake_payment_result(
  target_proposal_id uuid,
  payment_nonce uuid,
  payment_outcome text,
  actor_client_user_id uuid
)
returns table (
  payment_attempt_id uuid,
  resulting_proposal_status public.proposal_status,
  confirmed_job_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_proposal public.proposals%rowtype;
  accepted_version public.proposal_versions%rowtype;
  existing_attempt public.payment_attempts%rowtype;
  normalized_outcome text := upper(btrim(payment_outcome));
  created_attempt_id uuid;
  created_job_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'fake payment result is server-only';
  end if;

  if payment_nonce is null then
    raise exception using errcode = '22023', message = 'payment nonce is required';
  end if;

  if normalized_outcome not in ('SUCCESS', 'PENDING', 'FAILURE') then
    raise exception using errcode = '22023', message = 'invalid fake payment outcome';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if actor_client_user_id is null or actor_client_user_id <> target_proposal.client_user_id then
    raise exception using errcode = '42501', message = 'only the proposal client can initiate payment';
  end if;

  if target_proposal.accepted_version_id is null then
    raise exception using errcode = '42501', message = 'proposal has no accepted economic snapshot';
  end if;

  select * into accepted_version
  from public.proposal_versions
  where id = target_proposal.accepted_version_id;

  if accepted_version.price_amount is null or accepted_version.price_amount <= 0 then
    raise exception using errcode = '22023', message = 'accepted proposal has no payable amount';
  end if;

  select * into existing_attempt
  from public.payment_attempts
  where proposal_id = target_proposal_id
    and request_nonce = payment_nonce;

  if existing_attempt.id is not null then
    select j.id into created_job_id
    from public.jobs j
    where j.accepted_proposal_version_id = target_proposal.accepted_version_id;

    return query
    select existing_attempt.id, target_proposal.status, created_job_id;
    return;
  end if;

  if target_proposal.status = 'PAID' then
    select j.id into created_job_id
    from public.jobs j
    where j.accepted_proposal_version_id = target_proposal.accepted_version_id;

    return query
    select null::uuid, target_proposal.status, created_job_id;
    return;
  end if;

  if target_proposal.status not in ('AWAITING_PAYMENT', 'PAYMENT_FAILED') then
    raise exception using errcode = '42501', message = 'proposal is not payable';
  end if;

  if target_proposal.status = 'PAYMENT_FAILED' then
    update public.proposals
    set status = 'AWAITING_PAYMENT', updated_at = event_time
    where id = target_proposal_id;
  end if;

  insert into public.payment_attempts (
    proposal_id,
    accepted_proposal_version_id,
    request_nonce,
    provider_name,
    provider_reference,
    status,
    amount_minor,
    currency_code,
    created_at,
    updated_at
  ) values (
    target_proposal_id,
    target_proposal.accepted_version_id,
    payment_nonce,
    'FAKE',
    'fake:' || payment_nonce::text,
    case normalized_outcome
      when 'SUCCESS' then 'SUCCEEDED'::public.payment_status
      when 'PENDING' then 'PENDING'::public.payment_status
      else 'FAILED'::public.payment_status
    end,
    accepted_version.price_amount,
    accepted_version.currency_code,
    event_time,
    event_time
  )
  returning id into created_attempt_id;

  if normalized_outcome = 'SUCCESS' then
    update public.proposals
    set status = 'PAID', updated_at = event_time
    where id = target_proposal_id;

    insert into public.jobs (
      conversation_id,
      service_id,
      client_user_id,
      provider_user_id,
      accepted_proposal_version_id,
      payment_attempt_id,
      status,
      confirmed_at,
      created_at,
      updated_at
    ) values (
      target_proposal.conversation_id,
      target_proposal.service_id,
      target_proposal.client_user_id,
      target_proposal.provider_user_id,
      target_proposal.accepted_version_id,
      created_attempt_id,
      'CONFIRMED',
      event_time,
      event_time,
      event_time
    )
    on conflict (accepted_proposal_version_id)
    do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id
    returning id into created_job_id;

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_proposal.conversation_id,
      null,
      'SYSTEM',
      'Pago de prueba aprobado. Trabajo confirmado.',
      event_time
    );
  elsif normalized_outcome = 'FAILURE' then
    update public.proposals
    set status = 'PAYMENT_FAILED', updated_at = event_time
    where id = target_proposal_id;

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_proposal.conversation_id,
      null,
      'SYSTEM',
      'El pago de prueba falló. Podés volver a intentarlo.',
      event_time
    );
  end if;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_proposal_id,
    target_proposal.accepted_version_id,
    actor_client_user_id,
    'FAKE_PAYMENT_' || normalized_outcome,
    jsonb_build_object('payment_attempt_id', created_attempt_id),
    event_time
  );

  update public.conversations
  set last_message_at = case when normalized_outcome in ('SUCCESS', 'FAILURE') then event_time else last_message_at end,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return query
  select
    created_attempt_id,
    case normalized_outcome
      when 'SUCCESS' then 'PAID'::public.proposal_status
      when 'FAILURE' then 'PAYMENT_FAILED'::public.proposal_status
      else 'AWAITING_PAYMENT'::public.proposal_status
    end,
    created_job_id;
end;
$$;

revoke all on function public.apply_fake_payment_result(uuid, uuid, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.apply_fake_payment_result(uuid, uuid, text, uuid)
to service_role;

create or replace function public.list_conversation_proposals(
  target_conversation_id uuid
)
returns table (
  proposal_id uuid,
  proposal_kind public.proposal_kind,
  proposal_status public.proposal_status,
  created_by_user_id uuid,
  current_version_id uuid,
  accepted_version_id uuid,
  version_number integer,
  authored_by_user_id uuid,
  service_title text,
  modality public.service_modality,
  scope_text text,
  price_amount bigint,
  currency_code text,
  schedule_type public.schedule_type,
  schedule_start_at timestamptz,
  schedule_end_at timestamptz,
  deadline_at timestamptz,
  expected_duration_minutes integer,
  includes_text text,
  materials_notes_text text,
  expires_at timestamptz,
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
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and caller_id in (c.client_user_id, c.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  return query
  select
    p.id,
    p.kind,
    p.status,
    p.created_by_user_id,
    p.current_version_id,
    p.accepted_version_id,
    v.version_number,
    v.authored_by_user_id,
    v.service_title_snapshot,
    v.modality,
    v.scope_snapshot,
    v.price_amount,
    v.currency_code,
    v.schedule_type,
    v.schedule_start_at,
    v.schedule_end_at,
    v.deadline_at,
    v.expected_duration_minutes,
    v.includes_snapshot,
    v.materials_notes_snapshot,
    p.expires_at,
    p.created_at,
    p.updated_at
  from public.proposals p
  join public.proposal_versions v on v.id = p.current_version_id
  where p.conversation_id = target_conversation_id
  order by p.created_at asc, p.id asc;
end;
$$;

revoke all on function public.list_conversation_proposals(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_conversation_proposals(uuid)
to authenticated, service_role;
