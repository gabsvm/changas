-- Phase 11: admin payment visibility, participant-safe receipts, and authoritative
-- reconciliation for both proposal and additional-scope hosted checkouts.

alter table public.payment_settlements
  add column provider_payment_status public.payment_status,
  add column provider_status_detail text,
  add column provider_refunded_minor bigint check (provider_refunded_minor is null or provider_refunded_minor >= 0),
  add column reconciliation_mismatch boolean not null default false,
  add column reconciliation_mismatch_reason text;

alter table public.payment_settlements
  add constraint payment_settlements_provider_status_detail_check
    check (provider_status_detail is null or char_length(btrim(provider_status_detail)) between 1 and 240),
  add constraint payment_settlements_mismatch_reason_check
    check (reconciliation_mismatch_reason is null or char_length(btrim(reconciliation_mismatch_reason)) between 1 and 1000);

create or replace function public.capture_payment_settlement_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payment public.payment_attempts%rowtype;
  additional public.job_additional_payment_attempts%rowtype;
  checkout public.payment_checkout_sessions%rowtype;
begin
  if new.entry_type <> 'PROVIDER_NET' then
    return new;
  end if;

  if new.payment_attempt_id is not null then
    select * into payment from public.payment_attempts where id = new.payment_attempt_id;
    if payment.id is null then return new; end if;

    select * into checkout
    from public.payment_checkout_sessions checkout_row
    where checkout_row.purpose = 'PROPOSAL'
      and checkout_row.proposal_id = payment.proposal_id
      and checkout_row.request_nonce = payment.request_nonce
      and checkout_row.provider_name = payment.provider_name;

    if checkout.id is null then return new; end if;

    insert into public.payment_settlements (
      payment_attempt_id, provider_name, provider_payment_reference,
      seller_expected_net_minor, marketplace_fee_minor, settlement_status,
      last_reconciled_at
    ) values (
      payment.id, payment.provider_name, payment.provider_reference,
      checkout.provider_net_expected_minor, checkout.marketplace_fee_minor,
      'PAYMENT_CONFIRMED', timezone('utc', now())
    )
    on conflict (payment_attempt_id) where payment_attempt_id is not null
    do update set
      seller_expected_net_minor = excluded.seller_expected_net_minor,
      marketplace_fee_minor = excluded.marketplace_fee_minor,
      settlement_status = excluded.settlement_status,
      last_reconciled_at = excluded.last_reconciled_at,
      updated_at = timezone('utc', now());

    return new;
  end if;

  if new.additional_payment_attempt_id is not null then
    select * into additional
    from public.job_additional_payment_attempts
    where id = new.additional_payment_attempt_id;
    if additional.id is null then return new; end if;

    select * into checkout
    from public.payment_checkout_sessions checkout_row
    where checkout_row.purpose = 'SCOPE_CHANGE'
      and checkout_row.scope_change_id = additional.scope_change_id
      and checkout_row.request_nonce = additional.request_nonce
      and checkout_row.provider_name = additional.provider_name;

    if checkout.id is null then return new; end if;

    insert into public.payment_settlements (
      additional_payment_attempt_id, provider_name, provider_payment_reference,
      seller_expected_net_minor, marketplace_fee_minor, settlement_status,
      last_reconciled_at
    ) values (
      additional.id, additional.provider_name, additional.provider_reference,
      checkout.provider_net_expected_minor, checkout.marketplace_fee_minor,
      'PAYMENT_CONFIRMED', timezone('utc', now())
    )
    on conflict (additional_payment_attempt_id) where additional_payment_attempt_id is not null
    do update set
      seller_expected_net_minor = excluded.seller_expected_net_minor,
      marketplace_fee_minor = excluded.marketplace_fee_minor,
      settlement_status = excluded.settlement_status,
      last_reconciled_at = excluded.last_reconciled_at,
      updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.get_my_payment_receipt(target_payment_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  receipt jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select jsonb_build_object(
    'paymentAttemptId', payment.id,
    'clientUserId', proposal.client_user_id,
    'providerUserId', proposal.provider_user_id,
    'providerName', payment.provider_name,
    'providerReference', payment.provider_reference,
    'externalReference', checkout.external_reference,
    'amountMinor', payment.amount_minor,
    'currencyCode', payment.currency_code,
    'status', payment.status,
    'refundedMinor', coalesce((
      select sum(refund.amount_minor)
      from public.payment_refunds refund
      where refund.payment_attempt_id = payment.id
        and refund.status = 'SUCCEEDED'
    ), 0),
    'createdAt', payment.created_at
  ) into receipt
  from public.payment_attempts payment
  join public.proposals proposal on proposal.id = payment.proposal_id
  join public.payment_checkout_sessions checkout
    on checkout.purpose = 'PROPOSAL'
   and checkout.proposal_id = payment.proposal_id
   and checkout.request_nonce = payment.request_nonce
   and checkout.provider_name = payment.provider_name
  where payment.id = target_payment_attempt_id
    and auth.uid() in (proposal.client_user_id, proposal.provider_user_id);

  if receipt is null then
    if exists (select 1 from public.payment_attempts where id = target_payment_attempt_id) then
      raise exception using errcode = '42501', message = 'payment receipt access denied';
    end if;
    raise exception using errcode = 'P0002', message = 'payment receipt not found';
  end if;

  return receipt;
end;
$$;

revoke all on function public.get_my_payment_receipt(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_my_payment_receipt(uuid) to authenticated, service_role;

create or replace function public.list_admin_payment_finance(
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  payment_attempt_id uuid,
  proposal_id uuid,
  client_user_id uuid,
  provider_user_id uuid,
  provider_name text,
  provider_reference text,
  local_status text,
  provider_status text,
  gross_minor bigint,
  marketplace_fee_minor bigint,
  provider_expected_net_minor bigint,
  provider_fee_minor bigint,
  provider_net_received_minor bigint,
  settlement_status text,
  refund_status text,
  refunded_minor bigint,
  mismatch_flag boolean,
  mismatch_reason text,
  last_reconciled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  if page_size is null or page_size < 1 or page_size > 100
    or page_offset is null or page_offset < 0 or page_offset > 10000 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select
    payment.id,
    payment.proposal_id,
    proposal.client_user_id,
    proposal.provider_user_id,
    payment.provider_name,
    payment.provider_reference,
    payment.status::text,
    settlement.provider_payment_status::text,
    payment.amount_minor,
    checkout.marketplace_fee_minor,
    checkout.provider_net_expected_minor,
    settlement.provider_fee_minor,
    settlement.provider_net_received_minor,
    settlement.settlement_status,
    latest_refund.status::text,
    coalesce(refunds.refunded_minor, 0)::bigint,
    coalesce(settlement.reconciliation_mismatch, false),
    settlement.reconciliation_mismatch_reason,
    settlement.last_reconciled_at
  from public.payment_attempts payment
  join public.proposals proposal on proposal.id = payment.proposal_id
  join public.payment_checkout_sessions checkout
    on checkout.purpose = 'PROPOSAL'
   and checkout.proposal_id = payment.proposal_id
   and checkout.request_nonce = payment.request_nonce
   and checkout.provider_name = payment.provider_name
  left join public.payment_settlements settlement
    on settlement.payment_attempt_id = payment.id
  left join lateral (
    select refund.status
    from public.payment_refunds refund
    where refund.payment_attempt_id = payment.id
    order by refund.requested_at desc, refund.id desc
    limit 1
  ) latest_refund on true
  left join lateral (
    select coalesce(sum(refund.amount_minor), 0)::bigint as refunded_minor
    from public.payment_refunds refund
    where refund.payment_attempt_id = payment.id
      and refund.status = 'SUCCEEDED'
  ) refunds on true
  order by payment.created_at desc, payment.id desc
  limit page_size offset page_offset;
end;
$$;

revoke all on function public.list_admin_payment_finance(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_admin_payment_finance(integer, integer) to authenticated, service_role;

create or replace function public.list_admin_payment_reconciliation_runs(page_size integer default 20)
returns table (
  run_id uuid,
  initiator_type text,
  provider_name text,
  checked_count integer,
  matched_count integer,
  mismatched_count integer,
  failed_count integer,
  status text,
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  if page_size is null or page_size < 1 or page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select run.id, run.initiator_type, run.provider_name, run.checked_count,
    run.matched_count, run.mismatched_count, run.failed_count, run.status,
    run.started_at, run.finished_at, run.error_summary
  from public.payment_reconciliation_runs run
  order by run.started_at desc, run.id desc
  limit page_size;
end;
$$;

revoke all on function public.list_admin_payment_reconciliation_runs(integer) from public, anon, authenticated, service_role;
grant execute on function public.list_admin_payment_reconciliation_runs(integer) to authenticated, service_role;

create or replace function public.list_payment_reconciliation_candidates(
  reconciliation_provider_name text default 'MERCADO_PAGO',
  reconciliation_range_start timestamptz default null,
  reconciliation_range_end timestamptz default null
)
returns table (
  checkout_session_id uuid,
  payment_attempt_id uuid,
  additional_payment_attempt_id uuid,
  provider_name text,
  provider_payment_reference text,
  local_status text,
  amount_minor bigint,
  currency_code text,
  external_reference text,
  provider_account_reference text,
  access_token_ciphertext text,
  access_token_iv text,
  access_token_auth_tag text,
  encryption_key_version integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation candidates are server-only';
  end if;

  return query
  select checkout.id, payment.id, null::uuid, checkout.provider_name,
    payment.provider_reference, payment.status::text, payment.amount_minor,
    payment.currency_code, checkout.external_reference,
    account.provider_account_reference, account.access_token_ciphertext,
    account.access_token_iv, account.access_token_auth_tag, account.encryption_key_version
  from public.payment_checkout_sessions checkout
  join public.payment_attempts payment
    on checkout.purpose = 'PROPOSAL'
   and payment.proposal_id = checkout.proposal_id
   and payment.request_nonce = checkout.request_nonce
   and payment.provider_name = checkout.provider_name
  join public.payment_provider_accounts account on account.id = checkout.payment_provider_account_id
  where checkout.provider_name = upper(btrim(reconciliation_provider_name))
    and (reconciliation_range_start is null or payment.created_at >= reconciliation_range_start)
    and (reconciliation_range_end is null or payment.created_at <= reconciliation_range_end)

  union all

  select checkout.id, null::uuid, additional.id, checkout.provider_name,
    additional.provider_reference, additional.status::text, additional.amount_minor,
    additional.currency_code, checkout.external_reference,
    account.provider_account_reference, account.access_token_ciphertext,
    account.access_token_iv, account.access_token_auth_tag, account.encryption_key_version
  from public.payment_checkout_sessions checkout
  join public.job_additional_payment_attempts additional
    on checkout.purpose = 'SCOPE_CHANGE'
   and additional.scope_change_id = checkout.scope_change_id
   and additional.request_nonce = checkout.request_nonce
   and additional.provider_name = checkout.provider_name
  join public.payment_provider_accounts account on account.id = checkout.payment_provider_account_id
  where checkout.provider_name = upper(btrim(reconciliation_provider_name))
    and (reconciliation_range_start is null or additional.created_at >= reconciliation_range_start)
    and (reconciliation_range_end is null or additional.created_at <= reconciliation_range_end)
  order by checkout_session_id;
end;
$$;

revoke all on function public.list_payment_reconciliation_candidates(text, timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.list_payment_reconciliation_candidates(text, timestamptz, timestamptz) to service_role;

create or replace function public.record_payment_reconciliation_observation(
  target_checkout_session_id uuid,
  observed_provider_status public.payment_status,
  observed_provider_status_detail text,
  observed_amount_minor bigint,
  observed_currency_code text,
  observed_provider_account_reference text,
  observed_refunded_minor bigint,
  observed_provider_net_received_minor bigint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  checkout public.payment_checkout_sessions%rowtype;
  account public.payment_provider_accounts%rowtype;
  payment public.payment_attempts%rowtype;
  additional public.job_additional_payment_attempts%rowtype;
  local_status public.payment_status;
  mismatch boolean := false;
  reasons text[] := array[]::text[];
  provider_fee bigint;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation observation is server-only';
  end if;

  select * into checkout from public.payment_checkout_sessions where id = target_checkout_session_id;
  if checkout.id is null then
    raise exception using errcode = 'P0002', message = 'payment checkout not found';
  end if;
  select * into account from public.payment_provider_accounts where id = checkout.payment_provider_account_id;

  if checkout.purpose = 'PROPOSAL' then
    select * into payment from public.payment_attempts
    where proposal_id = checkout.proposal_id and request_nonce = checkout.request_nonce
      and provider_name = checkout.provider_name;
    if payment.id is null then raise exception using errcode = 'P0002', message = 'payment attempt not found'; end if;
    local_status := payment.status;
  else
    select * into additional from public.job_additional_payment_attempts
    where scope_change_id = checkout.scope_change_id and request_nonce = checkout.request_nonce
      and provider_name = checkout.provider_name;
    if additional.id is null then raise exception using errcode = 'P0002', message = 'additional payment attempt not found'; end if;
    local_status := additional.status;
  end if;

  if observed_amount_minor is distinct from checkout.amount_minor then mismatch := true; reasons := array_append(reasons, 'AMOUNT'); end if;
  if upper(btrim(observed_currency_code)) is distinct from checkout.currency_code then mismatch := true; reasons := array_append(reasons, 'CURRENCY'); end if;
  if btrim(observed_provider_account_reference) is distinct from account.provider_account_reference then mismatch := true; reasons := array_append(reasons, 'SELLER'); end if;
  if observed_provider_status = 'REFUNDED' then
    if local_status <> 'REFUNDED' then mismatch := true; reasons := array_append(reasons, 'STATUS'); end if;
  elsif local_status <> observed_provider_status then
    mismatch := true; reasons := array_append(reasons, 'STATUS');
  end if;

  if observed_provider_net_received_minor is not null then
    if observed_provider_net_received_minor > checkout.provider_net_expected_minor then
      mismatch := true;
      reasons := array_append(reasons, 'PROVIDER_NET');
      provider_fee := null;
    else
      provider_fee := checkout.provider_net_expected_minor - observed_provider_net_received_minor;
    end if;
  end if;

  if checkout.purpose = 'PROPOSAL' then
    insert into public.payment_settlements (
      payment_attempt_id, provider_name, provider_payment_reference,
      seller_expected_net_minor, marketplace_fee_minor, provider_fee_minor,
      provider_net_received_minor, settlement_status, provider_payment_status,
      provider_status_detail, provider_refunded_minor, reconciliation_mismatch,
      reconciliation_mismatch_reason, last_reconciled_at
    ) values (
      payment.id, checkout.provider_name, payment.provider_reference,
      checkout.provider_net_expected_minor, checkout.marketplace_fee_minor, provider_fee,
      observed_provider_net_received_minor, 'RECONCILED', observed_provider_status,
      nullif(btrim(observed_provider_status_detail), ''), observed_refunded_minor, mismatch,
      nullif(array_to_string(reasons, ','), ''), event_time
    )
    on conflict (payment_attempt_id) where payment_attempt_id is not null
    do update set
      provider_fee_minor = excluded.provider_fee_minor,
      provider_net_received_minor = excluded.provider_net_received_minor,
      settlement_status = excluded.settlement_status,
      provider_payment_status = excluded.provider_payment_status,
      provider_status_detail = excluded.provider_status_detail,
      provider_refunded_minor = excluded.provider_refunded_minor,
      reconciliation_mismatch = excluded.reconciliation_mismatch,
      reconciliation_mismatch_reason = excluded.reconciliation_mismatch_reason,
      last_reconciled_at = excluded.last_reconciled_at,
      updated_at = event_time;
  else
    insert into public.payment_settlements (
      additional_payment_attempt_id, provider_name, provider_payment_reference,
      seller_expected_net_minor, marketplace_fee_minor, provider_fee_minor,
      provider_net_received_minor, settlement_status, provider_payment_status,
      provider_status_detail, provider_refunded_minor, reconciliation_mismatch,
      reconciliation_mismatch_reason, last_reconciled_at
    ) values (
      additional.id, checkout.provider_name, additional.provider_reference,
      checkout.provider_net_expected_minor, checkout.marketplace_fee_minor, provider_fee,
      observed_provider_net_received_minor, 'RECONCILED', observed_provider_status,
      nullif(btrim(observed_provider_status_detail), ''), observed_refunded_minor, mismatch,
      nullif(array_to_string(reasons, ','), ''), event_time
    )
    on conflict (additional_payment_attempt_id) where additional_payment_attempt_id is not null
    do update set
      provider_fee_minor = excluded.provider_fee_minor,
      provider_net_received_minor = excluded.provider_net_received_minor,
      settlement_status = excluded.settlement_status,
      provider_payment_status = excluded.provider_payment_status,
      provider_status_detail = excluded.provider_status_detail,
      provider_refunded_minor = excluded.provider_refunded_minor,
      reconciliation_mismatch = excluded.reconciliation_mismatch,
      reconciliation_mismatch_reason = excluded.reconciliation_mismatch_reason,
      last_reconciled_at = excluded.last_reconciled_at,
      updated_at = event_time;
  end if;

  return mismatch;
end;
$$;

revoke all on function public.record_payment_reconciliation_observation(uuid, public.payment_status, text, bigint, text, text, bigint, bigint) from public, anon, authenticated, service_role;
grant execute on function public.record_payment_reconciliation_observation(uuid, public.payment_status, text, bigint, text, text, bigint, bigint) to service_role;

alter function public.reconcile_provider_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid)
  rename to reconcile_provider_proposal_payment;

create or replace function public.reconcile_provider_payment(
  target_checkout_session_id uuid,
  payment_provider_name text,
  payment_provider_reference text,
  payment_result_status public.payment_status,
  payment_amount_minor bigint,
  payment_currency_code text,
  payment_provider_account_reference text,
  source_provider_event_id uuid default null
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
  checkout public.payment_checkout_sessions%rowtype;
  account public.payment_provider_accounts%rowtype;
  provider_event public.payment_provider_events%rowtype;
  change public.job_scope_changes%rowtype;
  target_job public.jobs%rowtype;
  attempt public.job_additional_payment_attempts%rowtype;
  result_attempt_id uuid;
  event_time timestamptz := timezone('utc', now());
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_reference text := btrim(payment_provider_reference);
  normalized_currency text := upper(btrim(payment_currency_code));
  normalized_account_reference text := btrim(payment_provider_account_reference);
  ledger_metadata jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation is server-only';
  end if;

  select * into checkout from public.payment_checkout_sessions where id = target_checkout_session_id for update;
  if checkout.id is null then raise exception using errcode = 'P0002', message = 'payment checkout session not found'; end if;

  if checkout.purpose = 'PROPOSAL' then
    return query
    select * from public.reconcile_provider_proposal_payment(
      target_checkout_session_id, payment_provider_name, payment_provider_reference,
      payment_result_status, payment_amount_minor, payment_currency_code,
      payment_provider_account_reference, source_provider_event_id
    );
    return;
  end if;

  if checkout.purpose <> 'SCOPE_CHANGE' or checkout.scope_change_id is null then
    raise exception using errcode = '22023', message = 'unsupported payment checkout purpose';
  end if;
  if payment_result_status not in ('PENDING', 'SUCCEEDED', 'FAILED') then
    raise exception using errcode = '22023', message = 'additional payment result status is invalid';
  end if;
  if checkout.provider_name <> normalized_provider_name
    or checkout.amount_minor <> payment_amount_minor
    or checkout.currency_code <> normalized_currency then
    raise exception using errcode = '22023', message = 'provider payment does not match additional checkout truth';
  end if;

  select * into account from public.payment_provider_accounts where id = checkout.payment_provider_account_id for update;
  if account.id is null
    or account.provider_user_id <> checkout.provider_user_id
    or account.provider_name <> normalized_provider_name
    or account.provider_account_reference <> normalized_account_reference then
    raise exception using errcode = '42501', message = 'additional payment seller account mismatch';
  end if;

  if source_provider_event_id is not null then
    select * into provider_event from public.payment_provider_events where id = source_provider_event_id for update;
    if provider_event.id is null or provider_event.provider_name <> normalized_provider_name or not provider_event.signature_valid then
      raise exception using errcode = '42501', message = 'payment provider event is not trusted';
    end if;
  end if;

  select * into change from public.job_scope_changes where id = checkout.scope_change_id for update;
  if change.id is null then raise exception using errcode = 'P0002', message = 'scope change not found'; end if;
  select * into target_job from public.jobs where id = change.job_id for update;
  if target_job.id is null
    or target_job.client_user_id <> checkout.client_user_id
    or target_job.provider_user_id <> checkout.provider_user_id
    or change.additional_amount_minor <> checkout.amount_minor
    or change.currency_code <> checkout.currency_code then
    raise exception using errcode = '42501', message = 'additional checkout ownership or economics mismatch';
  end if;

  select * into attempt
  from public.job_additional_payment_attempts
  where scope_change_id = change.id and request_nonce = checkout.request_nonce
  for update;

  if attempt.id is null then
    select applied.payment_attempt_id into result_attempt_id
    from public.apply_additional_payment_result(
      change.id, checkout.request_nonce, normalized_provider_name,
      normalized_reference, payment_result_status, checkout.client_user_id
    ) applied;
    select * into attempt from public.job_additional_payment_attempts where id = result_attempt_id;
  else
    if attempt.provider_name <> normalized_provider_name
      or attempt.provider_reference <> normalized_reference
      or attempt.amount_minor <> checkout.amount_minor
      or attempt.currency_code <> checkout.currency_code then
      raise exception using errcode = '23505', message = 'additional payment identity is bound to different financial data';
    end if;

    result_attempt_id := attempt.id;
    if attempt.status in ('SUCCEEDED', 'FAILED') then
      if attempt.status <> payment_result_status then
        raise exception using errcode = '40001', message = 'terminal additional payment contradicts provider reconciliation';
      end if;
    elsif attempt.status = 'PENDING' then
      if payment_result_status <> 'PENDING' then
        update public.job_additional_payment_attempts
        set status = payment_result_status, updated_at = event_time
        where id = attempt.id;

        update public.job_scope_changes
        set status = case payment_result_status
          when 'SUCCEEDED' then 'PAID'::public.job_scope_change_status
          else 'PAYMENT_FAILED'::public.job_scope_change_status
        end,
        updated_at = event_time
        where id = change.id;

        insert into public.job_events(job_id, actor_user_id, event_type, metadata, created_at)
        values (
          target_job.id, checkout.client_user_id,
          case payment_result_status when 'SUCCEEDED' then 'ADDITIONAL_PAYMENT_SUCCEEDED' else 'ADDITIONAL_PAYMENT_FAILED' end,
          jsonb_build_object('scope_change_id', change.id, 'payment_attempt_id', attempt.id,
            'provider_name', normalized_provider_name, 'provider_reference', normalized_reference,
            'source', 'PROVIDER_RECONCILIATION'),
          event_time
        );
      end if;
    else
      raise exception using errcode = '40001', message = 'additional payment attempt is in incompatible state';
    end if;
  end if;

  if payment_result_status = 'SUCCEEDED' then
    update public.payment_checkout_sessions set status = 'COMPLETED', updated_at = event_time where id = checkout.id;
    ledger_metadata := jsonb_build_object('checkout_session_id', checkout.id, 'scope_change_id', change.id,
      'job_id', target_job.id, 'provider_name', normalized_provider_name);

    perform public.append_financial_ledger_entry(checkout.id, null, result_attempt_id, source_provider_event_id,
      'ADDITIONAL_CHARGE', 'CLIENT', checkout.amount_minor, checkout.currency_code, normalized_reference,
      'additional:' || checkout.id::text || ':gross', ledger_metadata);
    perform public.append_financial_ledger_entry(checkout.id, null, result_attempt_id, source_provider_event_id,
      'MARKETPLACE_FEE', 'MARKETPLACE', checkout.marketplace_fee_minor, checkout.currency_code, normalized_reference,
      'additional:' || checkout.id::text || ':marketplace-fee', ledger_metadata);
    perform public.append_financial_ledger_entry(checkout.id, null, result_attempt_id, source_provider_event_id,
      'PROVIDER_NET', 'PROVIDER', checkout.provider_net_expected_minor, checkout.currency_code, normalized_reference,
      'additional:' || checkout.id::text || ':provider-net', ledger_metadata);
  elsif payment_result_status = 'FAILED' then
    update public.payment_checkout_sessions set status = 'FAILED', updated_at = event_time where id = checkout.id;
  end if;

  if source_provider_event_id is not null then
    perform public.update_payment_provider_event_processing(source_provider_event_id, 'PROCESSED', null, null);
  end if;

  return query select result_attempt_id, null::public.proposal_status, target_job.id;
end;
$$;

revoke all on function public.reconcile_provider_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_provider_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid) to service_role;
