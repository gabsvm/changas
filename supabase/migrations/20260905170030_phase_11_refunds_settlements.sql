-- Phase 11: durable refunds, settlement snapshots, and reconciliation-run audit.
-- Refund completion remains provider-confirmed and financial effects stay append-only.

create type public.payment_refund_status as enum (
  'REQUESTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED'
);

create table public.payment_refunds (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  additional_payment_attempt_id uuid references public.job_additional_payment_attempts(id) on delete restrict,
  request_nonce uuid not null unique,
  provider_name text not null,
  provider_payment_reference text not null,
  provider_refund_reference text,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status public.payment_refund_status not null default 'REQUESTED',
  reason_code text,
  requested_by_user_id uuid references auth.users(id) on delete restrict,
  provider_event_id uuid references public.payment_provider_events(id) on delete restrict,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  check ((payment_attempt_id is not null) <> (additional_payment_attempt_id is not null)),
  check (char_length(btrim(provider_name)) between 2 and 80),
  check (char_length(btrim(provider_payment_reference)) between 1 and 240),
  check (provider_refund_reference is null or char_length(btrim(provider_refund_reference)) between 1 and 240),
  check (reason_code is null or char_length(btrim(reason_code)) between 1 and 120),
  check (
    (status in ('SUCCEEDED', 'FAILED') and completed_at is not null)
    or (status in ('REQUESTED', 'PENDING') and completed_at is null)
  )
);

create unique index payment_refunds_provider_reference_idx
on public.payment_refunds (provider_name, provider_refund_reference)
where provider_refund_reference is not null;

create index payment_refunds_payment_attempt_idx
on public.payment_refunds (payment_attempt_id, requested_at, id)
where payment_attempt_id is not null;

create index payment_refunds_additional_attempt_idx
on public.payment_refunds (additional_payment_attempt_id, requested_at, id)
where additional_payment_attempt_id is not null;

create index payment_refunds_status_idx
on public.payment_refunds (status, requested_at, id);

create trigger payment_refunds_set_updated_at
before update on public.payment_refunds
for each row execute function public.set_updated_at();

create table public.payment_settlements (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  additional_payment_attempt_id uuid references public.job_additional_payment_attempts(id) on delete restrict,
  provider_name text not null,
  provider_payment_reference text not null,
  seller_expected_net_minor bigint not null check (seller_expected_net_minor >= 0),
  marketplace_fee_minor bigint not null check (marketplace_fee_minor >= 0),
  provider_fee_minor bigint check (provider_fee_minor is null or provider_fee_minor >= 0),
  provider_net_received_minor bigint check (provider_net_received_minor is null or provider_net_received_minor >= 0),
  settlement_status text not null,
  provider_available_at timestamptz,
  provider_settled_at timestamptz,
  last_reconciled_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((payment_attempt_id is not null) <> (additional_payment_attempt_id is not null)),
  check (char_length(btrim(provider_name)) between 2 and 80),
  check (char_length(btrim(provider_payment_reference)) between 1 and 240),
  check (char_length(btrim(settlement_status)) between 1 and 120)
);

create unique index payment_settlements_payment_attempt_idx
on public.payment_settlements (payment_attempt_id)
where payment_attempt_id is not null;

create unique index payment_settlements_additional_attempt_idx
on public.payment_settlements (additional_payment_attempt_id)
where additional_payment_attempt_id is not null;

create index payment_settlements_status_idx
on public.payment_settlements (provider_name, settlement_status, last_reconciled_at, id);

create trigger payment_settlements_set_updated_at
before update on public.payment_settlements
for each row execute function public.set_updated_at();

create table public.payment_reconciliation_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  initiated_by_user_id uuid references auth.users(id) on delete set null,
  initiator_type text not null check (initiator_type in ('ADMIN', 'SYSTEM')),
  provider_name text,
  range_start timestamptz,
  range_end timestamptz,
  checked_count integer not null default 0 check (checked_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  mismatched_count integer not null default 0 check (mismatched_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'FAILED')),
  error_summary text check (error_summary is null or char_length(btrim(error_summary)) between 1 and 1000),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  check (range_end is null or range_start is null or range_end >= range_start),
  check (
    (status = 'RUNNING' and finished_at is null)
    or (status in ('COMPLETED', 'FAILED') and finished_at is not null)
  )
);

create index payment_reconciliation_runs_started_idx
on public.payment_reconciliation_runs (started_at desc, id desc);

alter table public.financial_ledger_entries
  add column refund_id uuid references public.payment_refunds(id) on delete restrict;

create index financial_ledger_refund_idx
on public.financial_ledger_entries (refund_id, created_at, id)
where refund_id is not null;

alter table public.payment_refunds enable row level security;
alter table public.payment_settlements enable row level security;
alter table public.payment_reconciliation_runs enable row level security;

revoke all privileges on table public.payment_refunds from public, anon, authenticated, service_role;
revoke all privileges on table public.payment_settlements from public, anon, authenticated, service_role;
revoke all privileges on table public.payment_reconciliation_runs from public, anon, authenticated, service_role;

grant select on table public.payment_refunds to service_role;
grant select on table public.payment_settlements to service_role;
grant select on table public.payment_reconciliation_runs to service_role;

create or replace function public.get_payment_refund_snapshot(target_payment_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment refund snapshot is server-only';
  end if;

  select jsonb_build_object(
    'paymentAttemptId', payment.id,
    'clientUserId', proposal.client_user_id,
    'providerUserId', proposal.provider_user_id,
    'paymentProviderAccountId', checkout.payment_provider_account_id,
    'providerName', payment.provider_name,
    'providerPaymentReference', payment.provider_reference,
    'amountMinor', payment.amount_minor,
    'refundableRemainingMinor', payment.amount_minor - coalesce((
      select sum(refund.amount_minor)
      from public.payment_refunds refund
      where refund.payment_attempt_id = payment.id
        and refund.status in ('REQUESTED', 'PENDING', 'SUCCEEDED')
    ), 0),
    'currencyCode', payment.currency_code,
    'paymentStatus', payment.status,
    'providerAccountReference', account.provider_account_reference,
    'accessToken', jsonb_build_object(
      'ciphertext', account.access_token_ciphertext,
      'iv', account.access_token_iv,
      'authTag', account.access_token_auth_tag,
      'keyVersion', account.encryption_key_version
    ),
    'encryptionKeyVersion', account.encryption_key_version
  ) into snapshot
  from public.payment_attempts payment
  join public.proposals proposal on proposal.id = payment.proposal_id
  join public.payment_checkout_sessions checkout
    on checkout.proposal_id = payment.proposal_id
   and checkout.request_nonce = payment.request_nonce
   and checkout.provider_name = payment.provider_name
  join public.payment_provider_accounts account
    on account.id = checkout.payment_provider_account_id
  where payment.id = target_payment_attempt_id
    and checkout.purpose = 'PROPOSAL';

  return snapshot;
end;
$$;

revoke all on function public.get_payment_refund_snapshot(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_payment_refund_snapshot(uuid) to service_role;

create or replace function public.get_payment_refund_by_nonce(refund_request_nonce uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  refund public.payment_refunds%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment refund lookup is server-only';
  end if;

  select * into refund
  from public.payment_refunds
  where request_nonce = refund_request_nonce;

  if refund.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', refund.id,
    'paymentAttemptId', refund.payment_attempt_id,
    'requestNonce', refund.request_nonce,
    'providerName', refund.provider_name,
    'providerPaymentReference', refund.provider_payment_reference,
    'providerRefundReference', refund.provider_refund_reference,
    'amountMinor', refund.amount_minor,
    'currencyCode', refund.currency_code,
    'status', refund.status,
    'reasonCode', refund.reason_code
  );
end;
$$;

revoke all on function public.get_payment_refund_by_nonce(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_payment_refund_by_nonce(uuid) to service_role;

create or replace function public.create_payment_refund_request(
  target_payment_attempt_id uuid,
  refund_request_nonce uuid,
  requested_by_user_id uuid,
  requested_amount_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payment public.payment_attempts%rowtype;
  proposal public.proposals%rowtype;
  existing_refund public.payment_refunds%rowtype;
  refund public.payment_refunds%rowtype;
  reserved_minor bigint;
  remaining_minor bigint;
  effective_amount_minor bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment refund creation is server-only';
  end if;

  select * into existing_refund
  from public.payment_refunds
  where request_nonce = refund_request_nonce;

  if existing_refund.id is not null then
    if existing_refund.payment_attempt_id is distinct from target_payment_attempt_id
      or (requested_amount_minor is not null and existing_refund.amount_minor <> requested_amount_minor) then
      raise exception using errcode = '23505', message = 'refund nonce is already bound to different refund data';
    end if;

    return jsonb_build_object(
      'id', existing_refund.id,
      'paymentAttemptId', existing_refund.payment_attempt_id,
      'requestNonce', existing_refund.request_nonce,
      'providerName', existing_refund.provider_name,
      'providerPaymentReference', existing_refund.provider_payment_reference,
      'providerRefundReference', existing_refund.provider_refund_reference,
      'amountMinor', existing_refund.amount_minor,
      'currencyCode', existing_refund.currency_code,
      'status', existing_refund.status,
      'reasonCode', existing_refund.reason_code
    );
  end if;

  select * into payment
  from public.payment_attempts
  where id = target_payment_attempt_id
  for update;

  if payment.id is null then
    raise exception using errcode = 'P0002', message = 'payment attempt was not found';
  end if;
  if payment.status not in ('SUCCEEDED', 'REFUNDED') then
    raise exception using errcode = '40001', message = 'only succeeded payments can be refunded';
  end if;
  if payment.provider_name <> 'MERCADO_PAGO' then
    raise exception using errcode = '22023', message = 'refund provider is not supported';
  end if;

  select * into proposal
  from public.proposals
  where id = payment.proposal_id;

  if proposal.id is null or proposal.client_user_id <> requested_by_user_id then
    raise exception using errcode = '42501', message = 'refund requester is not the payment client';
  end if;

  select coalesce(sum(amount_minor), 0) into reserved_minor
  from public.payment_refunds
  where payment_attempt_id = payment.id
    and status in ('REQUESTED', 'PENDING', 'SUCCEEDED');

  remaining_minor := payment.amount_minor - reserved_minor;
  effective_amount_minor := coalesce(requested_amount_minor, remaining_minor);

  if effective_amount_minor <= 0 or effective_amount_minor > remaining_minor then
    raise exception using errcode = '22023', message = 'refund amount exceeds durable refundable balance';
  end if;

  insert into public.payment_refunds (
    payment_attempt_id,
    request_nonce,
    provider_name,
    provider_payment_reference,
    amount_minor,
    currency_code,
    status,
    requested_by_user_id
  ) values (
    payment.id,
    refund_request_nonce,
    payment.provider_name,
    payment.provider_reference,
    effective_amount_minor,
    payment.currency_code,
    'REQUESTED',
    requested_by_user_id
  ) returning * into refund;

  return jsonb_build_object(
    'id', refund.id,
    'paymentAttemptId', refund.payment_attempt_id,
    'requestNonce', refund.request_nonce,
    'providerName', refund.provider_name,
    'providerPaymentReference', refund.provider_payment_reference,
    'providerRefundReference', refund.provider_refund_reference,
    'amountMinor', refund.amount_minor,
    'currencyCode', refund.currency_code,
    'status', refund.status,
    'reasonCode', refund.reason_code
  );
end;
$$;

revoke all on function public.create_payment_refund_request(uuid, uuid, uuid, bigint) from public, anon, authenticated, service_role;
grant execute on function public.create_payment_refund_request(uuid, uuid, uuid, bigint) to service_role;

create or replace function public.set_payment_refund_provider_result(
  target_refund_id uuid,
  payment_provider_refund_reference text,
  target_status public.payment_refund_status,
  target_reason_code text default null,
  source_provider_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  refund public.payment_refunds%rowtype;
  payment public.payment_attempts%rowtype;
  checkout public.payment_checkout_sessions%rowtype;
  normalized_reference text := nullif(btrim(payment_provider_refund_reference), '');
  normalized_reason text := nullif(btrim(target_reason_code), '');
  previous_succeeded_minor bigint := 0;
  cumulative_succeeded_minor bigint := 0;
  previous_fee_reversal_minor bigint := 0;
  cumulative_fee_reversal_minor bigint := 0;
  current_fee_reversal_minor bigint := 0;
  current_provider_reversal_minor bigint := 0;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment refund reconciliation is server-only';
  end if;

  select * into refund
  from public.payment_refunds
  where id = target_refund_id
  for update;

  if refund.id is null then
    raise exception using errcode = 'P0002', message = 'payment refund was not found';
  end if;

  if target_status = 'REQUESTED' then
    raise exception using errcode = '22023', message = 'refund reconciliation cannot transition back to requested';
  end if;

  if refund.status in ('SUCCEEDED', 'FAILED') then
    if refund.status <> target_status
      or (normalized_reference is not null and refund.provider_refund_reference is distinct from normalized_reference) then
      raise exception using errcode = '40001', message = 'terminal refund state cannot be changed';
    end if;

    return jsonb_build_object(
      'id', refund.id,
      'paymentAttemptId', refund.payment_attempt_id,
      'providerRefundReference', refund.provider_refund_reference,
      'amountMinor', refund.amount_minor,
      'currencyCode', refund.currency_code,
      'status', refund.status,
      'reasonCode', refund.reason_code
    );
  end if;

  if refund.status = 'REQUESTED' and target_status not in ('PENDING', 'FAILED') then
    raise exception using errcode = '40001', message = 'refund must be acknowledged before completion';
  end if;
  if refund.status = 'PENDING' and target_status not in ('SUCCEEDED', 'FAILED') then
    raise exception using errcode = '40001', message = 'pending refund transition is invalid';
  end if;

  if target_status in ('PENDING', 'SUCCEEDED') and normalized_reference is null then
    raise exception using errcode = '22023', message = 'provider refund reference is required';
  end if;

  if target_status = 'PENDING' then
    update public.payment_refunds
    set provider_refund_reference = normalized_reference,
        status = 'PENDING',
        provider_event_id = coalesce(source_provider_event_id, provider_event_id),
        reason_code = null
    where id = refund.id
    returning * into refund;

  elsif target_status = 'FAILED' then
    update public.payment_refunds
    set provider_refund_reference = coalesce(normalized_reference, provider_refund_reference),
        status = 'FAILED',
        provider_event_id = coalesce(source_provider_event_id, provider_event_id),
        reason_code = coalesce(normalized_reason, 'REFUND_REJECTED'),
        completed_at = event_time
    where id = refund.id
    returning * into refund;

  else
    select * into payment
    from public.payment_attempts
    where id = refund.payment_attempt_id
    for update;

    if payment.id is null or payment.status not in ('SUCCEEDED', 'REFUNDED') then
      raise exception using errcode = '40001', message = 'refund source payment is not refundable';
    end if;

    select * into checkout
    from public.payment_checkout_sessions
    where purpose = 'PROPOSAL'
      and proposal_id = payment.proposal_id
      and request_nonce = payment.request_nonce
      and provider_name = payment.provider_name;

    if checkout.id is null
      or checkout.amount_minor <> payment.amount_minor
      or checkout.currency_code <> payment.currency_code then
      raise exception using errcode = '22023', message = 'refund checkout economic snapshot mismatch';
    end if;

    select coalesce(sum(amount_minor), 0) into previous_succeeded_minor
    from public.payment_refunds
    where payment_attempt_id = payment.id
      and status = 'SUCCEEDED'
      and id <> refund.id;

    cumulative_succeeded_minor := previous_succeeded_minor + refund.amount_minor;
    if cumulative_succeeded_minor > payment.amount_minor then
      raise exception using errcode = '22023', message = 'cumulative refund exceeds original payment';
    end if;

    select coalesce(sum(amount_minor), 0) into previous_fee_reversal_minor
    from public.financial_ledger_entries
    where payment_attempt_id = payment.id
      and entry_type = 'MARKETPLACE_FEE_REVERSAL';

    cumulative_fee_reversal_minor := floor(
      (checkout.marketplace_fee_minor::numeric * cumulative_succeeded_minor::numeric)
      / payment.amount_minor::numeric
    )::bigint;
    if cumulative_succeeded_minor = payment.amount_minor then
      cumulative_fee_reversal_minor := checkout.marketplace_fee_minor;
    end if;

    current_fee_reversal_minor := cumulative_fee_reversal_minor - previous_fee_reversal_minor;
    current_provider_reversal_minor := refund.amount_minor - current_fee_reversal_minor;

    if current_fee_reversal_minor < 0 or current_provider_reversal_minor < 0 then
      raise exception using errcode = '22023', message = 'refund reversal economics are invalid';
    end if;

    insert into public.financial_ledger_entries (
      checkout_session_id, payment_attempt_id, provider_event_id, refund_id,
      entry_type, party_type, amount_minor, currency_code,
      provider_reference, idempotency_key, metadata
    ) values
      (
        checkout.id, payment.id, source_provider_event_id, refund.id,
        'REFUND', 'CLIENT', refund.amount_minor, refund.currency_code,
        normalized_reference, 'refund:' || refund.id::text || ':gross',
        jsonb_build_object('refund_id', refund.id)
      ),
      (
        checkout.id, payment.id, source_provider_event_id, refund.id,
        'MARKETPLACE_FEE_REVERSAL', 'MARKETPLACE', current_fee_reversal_minor, refund.currency_code,
        normalized_reference, 'refund:' || refund.id::text || ':marketplace-fee',
        jsonb_build_object('refund_id', refund.id)
      ),
      (
        checkout.id, payment.id, source_provider_event_id, refund.id,
        'PROVIDER_NET_REVERSAL', 'PROVIDER', current_provider_reversal_minor, refund.currency_code,
        normalized_reference, 'refund:' || refund.id::text || ':provider-net',
        jsonb_build_object('refund_id', refund.id)
      )
    on conflict (idempotency_key) do nothing;

    update public.payment_refunds
    set provider_refund_reference = normalized_reference,
        status = 'SUCCEEDED',
        provider_event_id = coalesce(source_provider_event_id, provider_event_id),
        reason_code = null,
        completed_at = event_time
    where id = refund.id
    returning * into refund;

    if cumulative_succeeded_minor = payment.amount_minor then
      update public.payment_attempts
      set status = 'REFUNDED', updated_at = event_time
      where id = payment.id;
    end if;

    insert into public.payment_settlements (
      payment_attempt_id,
      provider_name,
      provider_payment_reference,
      seller_expected_net_minor,
      marketplace_fee_minor,
      settlement_status,
      last_reconciled_at
    ) values (
      payment.id,
      payment.provider_name,
      payment.provider_reference,
      checkout.provider_net_expected_minor,
      checkout.marketplace_fee_minor,
      'REFUND_RECONCILED',
      event_time
    )
    on conflict (payment_attempt_id) where payment_attempt_id is not null
    do update set
      settlement_status = excluded.settlement_status,
      last_reconciled_at = excluded.last_reconciled_at,
      updated_at = event_time;
  end if;

  return jsonb_build_object(
    'id', refund.id,
    'paymentAttemptId', refund.payment_attempt_id,
    'providerRefundReference', refund.provider_refund_reference,
    'amountMinor', refund.amount_minor,
    'currencyCode', refund.currency_code,
    'status', refund.status,
    'reasonCode', refund.reason_code
  );
end;
$$;

revoke all on function public.set_payment_refund_provider_result(uuid, text, public.payment_refund_status, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_payment_refund_provider_result(uuid, text, public.payment_refund_status, text, uuid) to service_role;

create or replace function public.upsert_payment_settlement_snapshot(
  target_payment_attempt_id uuid,
  target_settlement_status text,
  target_provider_fee_minor bigint default null,
  target_provider_net_received_minor bigint default null,
  target_provider_available_at timestamptz default null,
  target_provider_settled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payment public.payment_attempts%rowtype;
  checkout public.payment_checkout_sessions%rowtype;
  settlement public.payment_settlements%rowtype;
  event_time timestamptz := timezone('utc', now());
  normalized_status text := nullif(btrim(target_settlement_status), '');
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment settlement snapshot is server-only';
  end if;
  if normalized_status is null or char_length(normalized_status) > 120 then
    raise exception using errcode = '22023', message = 'settlement status is invalid';
  end if;
  if target_provider_fee_minor is not null and target_provider_fee_minor < 0 then
    raise exception using errcode = '22023', message = 'provider fee cannot be negative';
  end if;
  if target_provider_net_received_minor is not null and target_provider_net_received_minor < 0 then
    raise exception using errcode = '22023', message = 'provider net cannot be negative';
  end if;

  select * into payment from public.payment_attempts where id = target_payment_attempt_id;
  if payment.id is null then
    raise exception using errcode = 'P0002', message = 'payment attempt was not found';
  end if;

  select * into checkout
  from public.payment_checkout_sessions
  where purpose = 'PROPOSAL'
    and proposal_id = payment.proposal_id
    and request_nonce = payment.request_nonce
    and provider_name = payment.provider_name;

  if checkout.id is null then
    raise exception using errcode = 'P0002', message = 'payment checkout was not found';
  end if;

  insert into public.payment_settlements (
    payment_attempt_id,
    provider_name,
    provider_payment_reference,
    seller_expected_net_minor,
    marketplace_fee_minor,
    provider_fee_minor,
    provider_net_received_minor,
    settlement_status,
    provider_available_at,
    provider_settled_at,
    last_reconciled_at
  ) values (
    payment.id,
    payment.provider_name,
    payment.provider_reference,
    checkout.provider_net_expected_minor,
    checkout.marketplace_fee_minor,
    target_provider_fee_minor,
    target_provider_net_received_minor,
    normalized_status,
    target_provider_available_at,
    target_provider_settled_at,
    event_time
  )
  on conflict (payment_attempt_id) where payment_attempt_id is not null
  do update set
    provider_fee_minor = excluded.provider_fee_minor,
    provider_net_received_minor = excluded.provider_net_received_minor,
    settlement_status = excluded.settlement_status,
    provider_available_at = excluded.provider_available_at,
    provider_settled_at = excluded.provider_settled_at,
    last_reconciled_at = excluded.last_reconciled_at,
    updated_at = event_time
  returning * into settlement;

  return jsonb_build_object(
    'id', settlement.id,
    'paymentAttemptId', settlement.payment_attempt_id,
    'sellerExpectedNetMinor', settlement.seller_expected_net_minor,
    'marketplaceFeeMinor', settlement.marketplace_fee_minor,
    'providerFeeMinor', settlement.provider_fee_minor,
    'providerNetReceivedMinor', settlement.provider_net_received_minor,
    'settlementStatus', settlement.settlement_status,
    'providerAvailableAt', settlement.provider_available_at,
    'providerSettledAt', settlement.provider_settled_at,
    'lastReconciledAt', settlement.last_reconciled_at
  );
end;
$$;

revoke all on function public.upsert_payment_settlement_snapshot(uuid, text, bigint, bigint, timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.upsert_payment_settlement_snapshot(uuid, text, bigint, bigint, timestamptz, timestamptz) to service_role;

create or replace function public.capture_payment_settlement_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payment public.payment_attempts%rowtype;
  checkout public.payment_checkout_sessions%rowtype;
begin
  if new.entry_type <> 'PROVIDER_NET' or new.payment_attempt_id is null then
    return new;
  end if;

  select * into payment from public.payment_attempts where id = new.payment_attempt_id;
  if payment.id is null then
    return new;
  end if;

  select * into checkout
  from public.payment_checkout_sessions
  where purpose = 'PROPOSAL'
    and proposal_id = payment.proposal_id
    and request_nonce = payment.request_nonce
    and provider_name = payment.provider_name;

  if checkout.id is null then
    return new;
  end if;

  insert into public.payment_settlements (
    payment_attempt_id,
    provider_name,
    provider_payment_reference,
    seller_expected_net_minor,
    marketplace_fee_minor,
    settlement_status,
    last_reconciled_at
  ) values (
    payment.id,
    payment.provider_name,
    payment.provider_reference,
    checkout.provider_net_expected_minor,
    checkout.marketplace_fee_minor,
    'PAYMENT_CONFIRMED',
    timezone('utc', now())
  )
  on conflict (payment_attempt_id) where payment_attempt_id is not null
  do update set
    seller_expected_net_minor = excluded.seller_expected_net_minor,
    marketplace_fee_minor = excluded.marketplace_fee_minor,
    settlement_status = excluded.settlement_status,
    last_reconciled_at = excluded.last_reconciled_at,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger financial_ledger_capture_settlement
after insert on public.financial_ledger_entries
for each row execute function public.capture_payment_settlement_from_ledger();

insert into public.payment_settlements (
  payment_attempt_id,
  provider_name,
  provider_payment_reference,
  seller_expected_net_minor,
  marketplace_fee_minor,
  settlement_status,
  last_reconciled_at
)
select distinct on (payment.id)
  payment.id,
  payment.provider_name,
  payment.provider_reference,
  checkout.provider_net_expected_minor,
  checkout.marketplace_fee_minor,
  'PAYMENT_CONFIRMED',
  timezone('utc', now())
from public.payment_attempts payment
join public.payment_checkout_sessions checkout
  on checkout.purpose = 'PROPOSAL'
 and checkout.proposal_id = payment.proposal_id
 and checkout.request_nonce = payment.request_nonce
 and checkout.provider_name = payment.provider_name
join public.financial_ledger_entries ledger
  on ledger.payment_attempt_id = payment.id
 and ledger.entry_type = 'PROVIDER_NET'
on conflict (payment_attempt_id) where payment_attempt_id is not null do nothing;

create or replace function public.start_payment_reconciliation_run(
  reconciliation_initiated_by_user_id uuid default null,
  reconciliation_initiator_type text default 'SYSTEM',
  reconciliation_provider_name text default null,
  reconciliation_range_start timestamptz default null,
  reconciliation_range_end timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  run_id uuid;
  normalized_type text := upper(btrim(reconciliation_initiator_type));
  normalized_provider text := nullif(upper(btrim(reconciliation_provider_name)), '');
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation run is server-only';
  end if;
  if normalized_type not in ('ADMIN', 'SYSTEM') then
    raise exception using errcode = '22023', message = 'reconciliation initiator type is invalid';
  end if;
  if reconciliation_range_start is not null and reconciliation_range_end is not null
    and reconciliation_range_end < reconciliation_range_start then
    raise exception using errcode = '22023', message = 'reconciliation date range is invalid';
  end if;

  insert into public.payment_reconciliation_runs (
    initiated_by_user_id,
    initiator_type,
    provider_name,
    range_start,
    range_end
  ) values (
    reconciliation_initiated_by_user_id,
    normalized_type,
    normalized_provider,
    reconciliation_range_start,
    reconciliation_range_end
  ) returning id into run_id;

  return run_id;
end;
$$;

revoke all on function public.start_payment_reconciliation_run(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.start_payment_reconciliation_run(uuid, text, text, timestamptz, timestamptz) to service_role;

create or replace function public.finish_payment_reconciliation_run(
  target_run_id uuid,
  target_checked_count integer,
  target_matched_count integer,
  target_mismatched_count integer,
  target_failed_count integer,
  target_error_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  run public.payment_reconciliation_runs%rowtype;
  normalized_error text := nullif(btrim(target_error_summary), '');
  final_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation run completion is server-only';
  end if;
  if target_checked_count < 0 or target_matched_count < 0
    or target_mismatched_count < 0 or target_failed_count < 0
    or target_matched_count + target_mismatched_count + target_failed_count > target_checked_count then
    raise exception using errcode = '22023', message = 'reconciliation counters are invalid';
  end if;

  select * into run
  from public.payment_reconciliation_runs
  where id = target_run_id
  for update;

  if run.id is null then
    raise exception using errcode = 'P0002', message = 'reconciliation run was not found';
  end if;
  if run.status <> 'RUNNING' then
    if run.checked_count = target_checked_count
      and run.matched_count = target_matched_count
      and run.mismatched_count = target_mismatched_count
      and run.failed_count = target_failed_count then
      return run.id;
    end if;
    raise exception using errcode = '40001', message = 'completed reconciliation run is immutable';
  end if;

  final_status := case when target_failed_count > 0 or normalized_error is not null then 'FAILED' else 'COMPLETED' end;

  update public.payment_reconciliation_runs
  set checked_count = target_checked_count,
      matched_count = target_matched_count,
      mismatched_count = target_mismatched_count,
      failed_count = target_failed_count,
      error_summary = normalized_error,
      status = final_status,
      finished_at = timezone('utc', now())
  where id = run.id;

  return run.id;
end;
$$;

revoke all on function public.finish_payment_reconciliation_run(uuid, integer, integer, integer, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.finish_payment_reconciliation_run(uuid, integer, integer, integer, integer, text) to service_role;
