begin;

select plan(24);

select ok(
  to_regclass('public.payment_refunds') is not null
  and to_regclass('public.payment_settlements') is not null
  and to_regclass('public.payment_reconciliation_runs') is not null,
  'refund, settlement, and reconciliation-run tables exist'
);

select ok(
  to_regprocedure('public.create_payment_refund_request(uuid,uuid,uuid,bigint)') is not null
  and to_regprocedure('public.set_payment_refund_provider_result(uuid,text,public.payment_refund_status,text,uuid)') is not null
  and to_regprocedure('public.upsert_payment_settlement_snapshot(uuid,text,bigint,bigint,timestamptz,timestamptz)') is not null
  and to_regprocedure('public.start_payment_reconciliation_run(uuid,text,text,timestamptz,timestamptz)') is not null
  and to_regprocedure('public.finish_payment_reconciliation_run(uuid,integer,integer,integer,integer,text)') is not null,
  'refund, settlement, and reconciliation RPCs exist'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_payment_refund_request(uuid,uuid,uuid,bigint)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.create_payment_refund_request(uuid,uuid,uuid,bigint)',
    'EXECUTE'
  ),
  'refund mutation is service-role only'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '12000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'phase11-refund-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Refund Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '12000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'phase11-refund-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Refund Provider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '12000000-0000-4000-8000-000000000002',
  'ACTIVE', 4, 'phase11-refund-provider', 'Phase 11 refund provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select '12000000-0000-4000-8000-000000000002', skill.id
from public.skills skill
where skill.is_active
order by skill.sort_order, skill.id
limit 1;

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description,
  modality, price_model, price_amount, currency_code, accepts_offers,
  schedule_type, is_published
)
select
  '12000000-0000-4000-8000-000000000010',
  '12000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  'phase11-refund-service',
  'Phase 11 refund service',
  'Synthetic service for Phase 11 refund and settlement contracts.',
  'REMOTE', 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from public.provider_skills provider_skill
where provider_skill.provider_user_id = '12000000-0000-4000-8000-000000000002'
limit 1;

insert into public.conversations (
  id, service_id, client_user_id, provider_user_id, status
) values (
  '12000000-0000-4000-8000-000000000020',
  '12000000-0000-4000-8000-000000000010',
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000002',
  'OPEN'
);

insert into public.proposals (
  id, conversation_id, service_id, client_user_id, provider_user_id,
  kind, status, created_by_user_id
) values (
  '12000000-0000-4000-8000-000000000030',
  '12000000-0000-4000-8000-000000000020',
  '12000000-0000-4000-8000-000000000010',
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000002',
  'PROVIDER_QUOTE', 'AWAITING_PAYMENT',
  '12000000-0000-4000-8000-000000000002'
);

insert into public.proposal_versions (
  id, proposal_id, version_number, kind, authored_by_user_id,
  service_title_snapshot, service_description_snapshot, modality,
  scope_snapshot, price_model_snapshot, price_amount, currency_code, schedule_type
) values (
  '12000000-0000-4000-8000-000000000040',
  '12000000-0000-4000-8000-000000000030',
  1, 'PROVIDER_QUOTE',
  '12000000-0000-4000-8000-000000000002',
  'Phase 11 refund service',
  'Synthetic accepted economic snapshot for refund testing.',
  'REMOTE', 'Synthetic refund scope',
  'FIXED', 100000, 'ARS', 'UNSCHEDULED'
);

update public.proposals
set current_version_id = '12000000-0000-4000-8000-000000000040',
    accepted_version_id = '12000000-0000-4000-8000-000000000040'
where id = '12000000-0000-4000-8000-000000000030';

insert into public.payment_provider_accounts (
  id, provider_user_id, provider_name, provider_account_reference,
  access_token_ciphertext, access_token_iv, access_token_auth_tag,
  refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag,
  encryption_key_version, status
) values (
  '12000000-0000-4000-8000-000000000050',
  '12000000-0000-4000-8000-000000000002',
  'MERCADO_PAGO', 'seller-refund-001',
  'ciphertext-access-refund', 'iv-access-refund', 'tag-access-refund',
  'ciphertext-refresh-refund', 'iv-refresh-refund', 'tag-refresh-refund',
  1, 'CONNECTED'
);

insert into public.payment_checkout_sessions (
  id, request_nonce, purpose, proposal_id, client_user_id, provider_user_id,
  payment_provider_account_id, provider_name, provider_checkout_reference,
  external_reference, amount_minor, marketplace_fee_minor,
  provider_net_expected_minor, currency_code, status, checkout_url
) values (
  '12000000-0000-4000-8000-000000000060',
  '12000000-0000-4000-8000-000000000061',
  'PROPOSAL', '12000000-0000-4000-8000-000000000030',
  '12000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000002',
  '12000000-0000-4000-8000-000000000050',
  'MERCADO_PAGO', 'preference-refund-001',
  'phase11:proposal:refund:001',
  100000, 10000, 90000, 'ARS', 'REDIRECT_READY',
  'https://example.test/checkout/refund'
);

select set_config('request.jwt.claim.role', 'service_role', true);

select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '12000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-refund-001', 'PENDING', 100000, 'ARS',
    'seller-refund-001', null
  )$$,
  'provider payment can enter pending before refund fixture succeeds'
);

select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '12000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-refund-001', 'SUCCEEDED', 100000, 'ARS',
    'seller-refund-001', null
  )$$,
  'provider payment can succeed before refund orchestration'
);

select ok(
  (select count(*) = 1 from public.payment_settlements settlement
    join public.payment_attempts payment on payment.id = settlement.payment_attempt_id
    where payment.proposal_id = '12000000-0000-4000-8000-000000000030')
  and (select seller_expected_net_minor = 90000 and marketplace_fee_minor = 10000
       and settlement_status = 'PAYMENT_CONFIRMED'
       from public.payment_settlements settlement
       join public.payment_attempts payment on payment.id = settlement.payment_attempt_id
       where payment.proposal_id = '12000000-0000-4000-8000-000000000030'),
  'successful provider-net ledger effect creates the initial settlement snapshot'
);

select lives_ok(
  $$select public.create_payment_refund_request(
    (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'),
    '12000000-0000-4000-8000-000000000101',
    '12000000-0000-4000-8000-000000000001',
    25000
  )$$,
  'client can create a durable partial refund request through service orchestration'
);

select ok(
  (select status = 'REQUESTED' and amount_minor = 25000
   from public.payment_refunds
   where request_nonce = '12000000-0000-4000-8000-000000000101'),
  'new partial refund stays REQUESTED and preserves its amount snapshot'
);

select lives_ok(
  $$select public.create_payment_refund_request(
    (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'),
    '12000000-0000-4000-8000-000000000101',
    '12000000-0000-4000-8000-000000000001',
    25000
  )$$,
  'replaying the same refund nonce is idempotent'
);

select is(
  (select count(*)::integer from public.payment_refunds
   where request_nonce = '12000000-0000-4000-8000-000000000101'),
  1,
  'duplicate refund nonce cannot create a second durable refund'
);

select lives_ok(
  $$select public.set_payment_refund_provider_result(
    (select id from public.payment_refunds where request_nonce = '12000000-0000-4000-8000-000000000101'),
    'refund-provider-001', 'PENDING', null, null
  )$$,
  'provider acknowledgement moves refund to PENDING without claiming success'
);

select ok(
  (select status = 'PENDING' from public.payment_refunds
   where request_nonce = '12000000-0000-4000-8000-000000000101')
  and (select count(*) = 0 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where refund.request_nonce = '12000000-0000-4000-8000-000000000101'),
  'PENDING refund has no successful financial reversal effects'
);

select lives_ok(
  $$select public.set_payment_refund_provider_result(
    (select id from public.payment_refunds where request_nonce = '12000000-0000-4000-8000-000000000101'),
    'refund-provider-001', 'SUCCEEDED', null, null
  )$$,
  'authoritative provider confirmation completes the partial refund'
);

select ok(
  (select count(*) = 3 from public.financial_ledger_entries ledger
   join public.payment_refunds refund on refund.id = ledger.refund_id
   where refund.request_nonce = '12000000-0000-4000-8000-000000000101')
  and (select coalesce(sum(amount_minor), 0) = 25000 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where refund.request_nonce = '12000000-0000-4000-8000-000000000101'
         and ledger.entry_type = 'REFUND')
  and (select coalesce(sum(amount_minor), 0) = 2500 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where refund.request_nonce = '12000000-0000-4000-8000-000000000101'
         and ledger.entry_type = 'MARKETPLACE_FEE_REVERSAL')
  and (select coalesce(sum(amount_minor), 0) = 22500 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where refund.request_nonce = '12000000-0000-4000-8000-000000000101'
         and ledger.entry_type = 'PROVIDER_NET_REVERSAL'),
  'partial refund appends gross, marketplace fee, and provider-net reversals exactly'
);

select lives_ok(
  $$select public.set_payment_refund_provider_result(
    (select id from public.payment_refunds where request_nonce = '12000000-0000-4000-8000-000000000101'),
    'refund-provider-001', 'SUCCEEDED', null, null
  )$$,
  'terminal refund success replay is idempotent'
);

select is(
  (select count(*)::integer from public.financial_ledger_entries ledger
   join public.payment_refunds refund on refund.id = ledger.refund_id
   where refund.request_nonce = '12000000-0000-4000-8000-000000000101'),
  3,
  'terminal refund replay cannot duplicate ledger reversals'
);

select is(
  (select status::text from public.payment_attempts
   where proposal_id = '12000000-0000-4000-8000-000000000030'),
  'SUCCEEDED',
  'partial refund does not falsely mark the full payment refunded'
);

select lives_ok(
  $$select public.create_payment_refund_request(
    (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'),
    '12000000-0000-4000-8000-000000000102',
    '12000000-0000-4000-8000-000000000001',
    1000
  )$$,
  'a later refund request can be created from the remaining balance'
);

select lives_ok(
  $$select public.set_payment_refund_provider_result(
    (select id from public.payment_refunds where request_nonce = '12000000-0000-4000-8000-000000000102'),
    null, 'FAILED', 'REFUND_REJECTED', null
  )$$,
  'provider rejection is durably recorded as FAILED'
);

select ok(
  (select status = 'FAILED' from public.payment_refunds
   where request_nonce = '12000000-0000-4000-8000-000000000102')
  and (select count(*) = 0 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where refund.request_nonce = '12000000-0000-4000-8000-000000000102'),
  'failed refund never creates successful reversal ledger effects'
);

select lives_ok(
  $$select public.create_payment_refund_request(
    (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'),
    '12000000-0000-4000-8000-000000000103',
    '12000000-0000-4000-8000-000000000001',
    null
  )$$,
  'null amount derives the exact remaining refundable balance'
);

select is(
  (select amount_minor::bigint from public.payment_refunds
   where request_nonce = '12000000-0000-4000-8000-000000000103'),
  75000::bigint,
  'failed refunds do not consume refundable balance and full remainder is 75000'
);

select lives_ok(
  $$select public.set_payment_refund_provider_result(
    (select id from public.payment_refunds where request_nonce = '12000000-0000-4000-8000-000000000103'),
    'refund-provider-003', 'PENDING', null, null
  );
  select public.set_payment_refund_provider_result(
    (select id from public.payment_refunds where request_nonce = '12000000-0000-4000-8000-000000000103'),
    'refund-provider-003', 'SUCCEEDED', null, null
  )$$,
  'remaining refund completes only after provider confirmation'
);

select ok(
  (select status::text = 'REFUNDED' from public.payment_attempts
   where proposal_id = '12000000-0000-4000-8000-000000000030')
  and (select coalesce(sum(amount_minor), 0) = 100000 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where ledger.entry_type = 'REFUND'
         and refund.payment_attempt_id = (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'))
  and (select coalesce(sum(amount_minor), 0) = 10000 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where ledger.entry_type = 'MARKETPLACE_FEE_REVERSAL'
         and refund.payment_attempt_id = (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'))
  and (select coalesce(sum(amount_minor), 0) = 90000 from public.financial_ledger_entries ledger
       join public.payment_refunds refund on refund.id = ledger.refund_id
       where ledger.entry_type = 'PROVIDER_NET_REVERSAL'
         and refund.payment_attempt_id = (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030')),
  'cumulative full refund caps at gross and exactly reverses marketplace fee plus provider net'
);

select throws_ok(
  $$select public.create_payment_refund_request(
    (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'),
    '12000000-0000-4000-8000-000000000104',
    '12000000-0000-4000-8000-000000000001',
    1
  )$$,
  '22023', null,
  'cumulative refunds can never exceed the original durable payment amount'
);

select lives_ok(
  $$select public.upsert_payment_settlement_snapshot(
    (select id from public.payment_attempts where proposal_id = '12000000-0000-4000-8000-000000000030'),
    'AVAILABLE', 3500, 86500,
    timezone('utc', now()), null
  )$$,
  'provider settlement metadata can update the local reconciliation snapshot'
);

select ok(
  (select seller_expected_net_minor = 90000
      and marketplace_fee_minor = 10000
      and provider_fee_minor = 3500
      and provider_net_received_minor = 86500
      and settlement_status = 'AVAILABLE'
   from public.payment_settlements settlement
   join public.payment_attempts payment on payment.id = settlement.payment_attempt_id
   where payment.proposal_id = '12000000-0000-4000-8000-000000000030'),
  'settlement keeps expected economics separate from provider-reported fee and net'
);

create temporary table phase11_refund_run (id uuid primary key);
insert into phase11_refund_run(id)
select public.start_payment_reconciliation_run(
  null, 'SYSTEM', 'MERCADO_PAGO', null, null
);

select lives_ok(
  $$select public.finish_payment_reconciliation_run(
    (select id from phase11_refund_run),
    3, 2, 1, 0, null
  )$$,
  'reconciliation run can be completed with durable counters'
);

select ok(
  (select status = 'COMPLETED'
      and checked_count = 3
      and matched_count = 2
      and mismatched_count = 1
      and failed_count = 0
      and finished_at is not null
   from public.payment_reconciliation_runs
   where id = (select id from phase11_refund_run)),
  'reconciliation run retains scope result counts and completion timestamp'
);

select * from finish();
rollback;
