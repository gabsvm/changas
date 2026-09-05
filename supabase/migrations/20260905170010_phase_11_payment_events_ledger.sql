-- Phase 11: sanitized provider event audit and immutable operational ledger.
-- Provider notifications are idempotent receipts, not authoritative payment truth.
-- Financial effects are append-only and mutation is restricted to server functions.

create type public.payment_provider_event_processing_status as enum (
  'RECEIVED',
  'IGNORED',
  'PROCESSED',
  'FAILED'
);

create type public.financial_ledger_entry_type as enum (
  'GROSS_PAYMENT',
  'MARKETPLACE_FEE',
  'PROVIDER_NET',
  'PAYMENT_PROVIDER_FEE',
  'ADDITIONAL_CHARGE',
  'REFUND',
  'MARKETPLACE_FEE_REVERSAL',
  'PROVIDER_NET_REVERSAL',
  'CHARGEBACK',
  'SETTLEMENT_STATUS'
);

create type public.financial_ledger_party_type as enum (
  'CLIENT',
  'PROVIDER',
  'MARKETPLACE',
  'PAYMENT_PROVIDER'
);

create table public.payment_provider_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_name text not null,
  provider_event_key text not null,
  provider_resource_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  processing_status public.payment_provider_event_processing_status not null default 'RECEIVED',
  payload_sha256 text not null,
  provider_status text,
  provider_reference text,
  failure_code text,
  failure_message text,
  check (char_length(btrim(provider_name)) between 2 and 80),
  check (char_length(btrim(provider_event_key)) between 2 and 240),
  check (char_length(btrim(provider_resource_id)) between 1 and 240),
  check (char_length(btrim(event_type)) between 1 and 120),
  check (payload_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  check (provider_status is null or char_length(btrim(provider_status)) between 1 and 120),
  check (provider_reference is null or char_length(btrim(provider_reference)) between 1 and 240),
  check (failure_code is null or char_length(btrim(failure_code)) between 1 and 120),
  check (failure_message is null or char_length(btrim(failure_message)) between 1 and 1000),
  check (
    (processing_status in ('PROCESSED', 'IGNORED', 'FAILED') and processed_at is not null)
    or (processing_status = 'RECEIVED' and processed_at is null)
  ),
  unique (provider_name, provider_event_key)
);

create index payment_provider_events_resource_idx
on public.payment_provider_events (provider_name, provider_resource_id, received_at desc);

create index payment_provider_events_processing_idx
on public.payment_provider_events (processing_status, received_at, id);

create table public.financial_ledger_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  checkout_session_id uuid references public.payment_checkout_sessions(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  additional_payment_attempt_id uuid references public.job_additional_payment_attempts(id) on delete restrict,
  provider_event_id uuid references public.payment_provider_events(id) on delete restrict,
  entry_type public.financial_ledger_entry_type not null,
  party_type public.financial_ledger_party_type not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  provider_reference text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (provider_reference is null or char_length(btrim(provider_reference)) between 1 and 240),
  check (char_length(btrim(idempotency_key)) between 6 and 240),
  check (jsonb_typeof(metadata) = 'object'),
  unique (idempotency_key)
);

create index financial_ledger_checkout_idx
on public.financial_ledger_entries (checkout_session_id, created_at, id)
where checkout_session_id is not null;

create index financial_ledger_payment_attempt_idx
on public.financial_ledger_entries (payment_attempt_id, created_at, id)
where payment_attempt_id is not null;

create index financial_ledger_additional_attempt_idx
on public.financial_ledger_entries (additional_payment_attempt_id, created_at, id)
where additional_payment_attempt_id is not null;

create index financial_ledger_provider_event_idx
on public.financial_ledger_entries (provider_event_id, created_at, id)
where provider_event_id is not null;

create or replace function public.reject_financial_ledger_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '42501', message = 'financial ledger entries are immutable';
end;
$$;

create trigger financial_ledger_entries_immutable_guard
before update or delete on public.financial_ledger_entries
for each row execute function public.reject_financial_ledger_mutation();

alter table public.payment_provider_events enable row level security;
alter table public.financial_ledger_entries enable row level security;

revoke all privileges on table public.payment_provider_events from public, anon, authenticated, service_role;
revoke all privileges on table public.financial_ledger_entries from public, anon, authenticated, service_role;

grant select on table public.payment_provider_events to service_role;
grant select on table public.financial_ledger_entries to service_role;

create or replace function public.record_payment_provider_event(
  payment_provider_name text,
  payment_provider_event_key text,
  payment_provider_resource_id text,
  payment_event_type text,
  payment_signature_valid boolean,
  payment_payload_sha256 text,
  payment_provider_status text default null,
  payment_provider_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_event_key text := btrim(payment_provider_event_key);
  normalized_resource_id text := btrim(payment_provider_resource_id);
  normalized_event_type text := upper(btrim(payment_event_type));
  normalized_payload_sha256 text := lower(btrim(payment_payload_sha256));
  normalized_provider_status text := nullif(btrim(payment_provider_status), '');
  normalized_provider_reference text := nullif(btrim(payment_provider_reference), '');
  existing_event public.payment_provider_events%rowtype;
  event_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment provider event mutation is server-only';
  end if;

  if normalized_provider_name is null
    or char_length(normalized_provider_name) not between 2 and 80
    or normalized_event_key is null
    or char_length(normalized_event_key) not between 2 and 240
    or normalized_resource_id is null
    or char_length(normalized_resource_id) not between 1 and 240
    or normalized_event_type is null
    or char_length(normalized_event_type) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'payment provider event identity is invalid';
  end if;

  if normalized_payload_sha256 is null or normalized_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'payment provider event payload hash is invalid';
  end if;

  select * into existing_event
  from public.payment_provider_events
  where provider_name = normalized_provider_name
    and provider_event_key = normalized_event_key;

  if existing_event.id is not null then
    if existing_event.provider_resource_id <> normalized_resource_id
      or existing_event.event_type <> normalized_event_type
      or existing_event.signature_valid is distinct from payment_signature_valid
      or existing_event.payload_sha256 <> normalized_payload_sha256 then
      raise exception using errcode = '23505', message = 'provider event key is already bound to different event data';
    end if;

    return existing_event.id;
  end if;

  insert into public.payment_provider_events (
    provider_name,
    provider_event_key,
    provider_resource_id,
    event_type,
    signature_valid,
    payload_sha256,
    provider_status,
    provider_reference
  ) values (
    normalized_provider_name,
    normalized_event_key,
    normalized_resource_id,
    normalized_event_type,
    payment_signature_valid,
    normalized_payload_sha256,
    normalized_provider_status,
    normalized_provider_reference
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.record_payment_provider_event(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.record_payment_provider_event(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text
) to service_role;

create or replace function public.update_payment_provider_event_processing(
  target_event_id uuid,
  target_processing_status public.payment_provider_event_processing_status,
  target_failure_code text default null,
  target_failure_message text default null
)
returns public.payment_provider_event_processing_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  event_time timestamptz := timezone('utc', now());
  normalized_failure_code text := nullif(btrim(target_failure_code), '');
  normalized_failure_message text := nullif(btrim(target_failure_message), '');
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment provider event processing is server-only';
  end if;

  if target_processing_status = 'RECEIVED' then
    raise exception using errcode = '22023', message = 'processed event cannot transition back to received';
  end if;

  update public.payment_provider_events
  set processing_status = target_processing_status,
      processed_at = event_time,
      failure_code = case when target_processing_status = 'FAILED' then normalized_failure_code else null end,
      failure_message = case when target_processing_status = 'FAILED' then normalized_failure_message else null end
  where id = target_event_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment provider event not found';
  end if;

  return target_processing_status;
end;
$$;

revoke all on function public.update_payment_provider_event_processing(
  uuid,
  public.payment_provider_event_processing_status,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.update_payment_provider_event_processing(
  uuid,
  public.payment_provider_event_processing_status,
  text,
  text
) to service_role;

create or replace function public.append_financial_ledger_entry(
  source_checkout_session_id uuid,
  source_payment_attempt_id uuid,
  source_additional_payment_attempt_id uuid,
  source_provider_event_id uuid,
  ledger_entry_type public.financial_ledger_entry_type,
  ledger_party_type public.financial_ledger_party_type,
  ledger_amount_minor bigint,
  ledger_currency_code text,
  ledger_provider_reference text,
  ledger_idempotency_key text,
  ledger_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_currency_code text := upper(btrim(ledger_currency_code));
  normalized_provider_reference text := nullif(btrim(ledger_provider_reference), '');
  normalized_idempotency_key text := btrim(ledger_idempotency_key);
  normalized_metadata jsonb := coalesce(ledger_metadata, '{}'::jsonb);
  existing_entry public.financial_ledger_entries%rowtype;
  entry_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'financial ledger mutation is server-only';
  end if;

  if ledger_amount_minor is null or ledger_amount_minor < 0 then
    raise exception using errcode = '22023', message = 'ledger amount is invalid';
  end if;

  if normalized_currency_code is null or normalized_currency_code !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'ledger currency is invalid';
  end if;

  if normalized_idempotency_key is null
    or char_length(normalized_idempotency_key) not between 6 and 240 then
    raise exception using errcode = '22023', message = 'ledger idempotency key is invalid';
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'ledger metadata must be an object';
  end if;

  select * into existing_entry
  from public.financial_ledger_entries
  where idempotency_key = normalized_idempotency_key;

  if existing_entry.id is not null then
    if existing_entry.checkout_session_id is distinct from source_checkout_session_id
      or existing_entry.payment_attempt_id is distinct from source_payment_attempt_id
      or existing_entry.additional_payment_attempt_id is distinct from source_additional_payment_attempt_id
      or existing_entry.provider_event_id is distinct from source_provider_event_id
      or existing_entry.entry_type is distinct from ledger_entry_type
      or existing_entry.party_type is distinct from ledger_party_type
      or existing_entry.amount_minor <> ledger_amount_minor
      or existing_entry.currency_code <> normalized_currency_code
      or existing_entry.provider_reference is distinct from normalized_provider_reference
      or existing_entry.metadata <> normalized_metadata then
      raise exception using errcode = '23505', message = 'ledger idempotency key is already bound to different financial data';
    end if;

    return existing_entry.id;
  end if;

  insert into public.financial_ledger_entries (
    checkout_session_id,
    payment_attempt_id,
    additional_payment_attempt_id,
    provider_event_id,
    entry_type,
    party_type,
    amount_minor,
    currency_code,
    provider_reference,
    idempotency_key,
    metadata
  ) values (
    source_checkout_session_id,
    source_payment_attempt_id,
    source_additional_payment_attempt_id,
    source_provider_event_id,
    ledger_entry_type,
    ledger_party_type,
    ledger_amount_minor,
    normalized_currency_code,
    normalized_provider_reference,
    normalized_idempotency_key,
    normalized_metadata
  )
  returning id into entry_id;

  return entry_id;
end;
$$;

revoke all on function public.append_financial_ledger_entry(
  uuid,
  uuid,
  uuid,
  uuid,
  public.financial_ledger_entry_type,
  public.financial_ledger_party_type,
  bigint,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.append_financial_ledger_entry(
  uuid,
  uuid,
  uuid,
  uuid,
  public.financial_ledger_entry_type,
  public.financial_ledger_party_type,
  bigint,
  text,
  text,
  text,
  jsonb
) to service_role;
