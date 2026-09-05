begin;

select plan(29);

select has_function(
  'public',
  'reconcile_provider_payment',
  array['uuid','text','text','public.payment_status','bigint','text','text','uuid'],
  'authoritative provider payment reconciliation RPC exists'
);

select ok(
  coalesce(
    has_function_privilege(
      'service_role',
      to_regprocedure('public.reconcile_provider_payment(uuid,text,text,public.payment_status,bigint,text,text,uuid)'),
      'EXECUTE'
    ),
    false
  )
  and not coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.reconcile_provider_payment(uuid,text,text,public.payment_status,bigint,text,text,uuid)'),
      'EXECUTE'
    ),
    false
  )
  and not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.reconcile_provider_payment(uuid,text,text,public.payment_status,bigint,text,text,uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'payment reconciliation is service-role only'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'phase11-reconcile-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase11 Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'phase11-reconcile-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase11 Provider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '11000000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  'phase11-reconcile-provider',
  'Phase 11 reconciliation provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select
  '11000000-0000-4000-8000-000000000002',
  skill.id
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
  '11000000-0000-4000-8000-000000000010',
  '11000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  'phase11-reconciliation-service',
  'Phase 11 reconciliation service',
  'Synthetic service used only by the Phase 11 reconciliation pgTAP contract.',
  'REMOTE', 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from public.provider_skills provider_skill
where provider_skill.provider_user_id = '11000000-0000-4000-8000-000000000002'
limit 1;

insert into public.conversations (
  id, service_id, client_user_id, provider_user_id, status
) values (
  '11000000-0000-4000-8000-000000000020',
  '11000000-0000-4000-8000-000000000010',
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000002',
  'OPEN'
);

insert into public.proposals (
  id, conversation_id, service_id, client_user_id, provider_user_id,
  kind, status, created_by_user_id
) values
  (
    '11000000-0000-4000-8000-000000000030',
    '11000000-0000-4000-8000-000000000020',
    '11000000-0000-4000-8000-000000000010',
    '11000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    'PROVIDER_QUOTE', 'AWAITING_PAYMENT',
    '11000000-0000-4000-8000-000000000002'
  ),
  (
    '11000000-0000-4000-8000-000000000031',
    '11000000-0000-4000-8000-000000000020',
    '11000000-0000-4000-8000-000000000010',
    '11000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    'PROVIDER_QUOTE', 'AWAITING_PAYMENT',
    '11000000-0000-4000-8000-000000000002'
  );

insert into public.proposal_versions (
  id, proposal_id, version_number, kind, authored_by_user_id,
  service_title_snapshot, service_description_snapshot, modality,
  scope_snapshot, price_model_snapshot, price_amount, currency_code, schedule_type
) values
  (
    '11000000-0000-4000-8000-000000000040',
    '11000000-0000-4000-8000-000000000030',
    1, 'PROVIDER_QUOTE',
    '11000000-0000-4000-8000-000000000002',
    'Phase 11 reconciliation service',
    'Synthetic accepted economic snapshot for successful reconciliation.',
    'REMOTE', 'Synthetic success reconciliation scope',
    'FIXED', 100000, 'ARS', 'UNSCHEDULED'
  ),
  (
    '11000000-0000-4000-8000-000000000041',
    '11000000-0000-4000-8000-000000000031',
    1, 'PROVIDER_QUOTE',
    '11000000-0000-4000-8000-000000000002',
    'Phase 11 reconciliation service',
    'Synthetic accepted economic snapshot for failed reconciliation.',
    'REMOTE', 'Synthetic failed reconciliation scope',
    'FIXED', 100000, 'ARS', 'UNSCHEDULED'
  );

update public.proposals
set
  current_version_id = case id
    when '11000000-0000-4000-8000-000000000030' then '11000000-0000-4000-8000-000000000040'::uuid
    else '11000000-0000-4000-8000-000000000041'::uuid
  end,
  accepted_version_id = case id
    when '11000000-0000-4000-8000-000000000030' then '11000000-0000-4000-8000-000000000040'::uuid
    else '11000000-0000-4000-8000-000000000041'::uuid
  end
where id in (
  '11000000-0000-4000-8000-000000000030',
  '11000000-0000-4000-8000-000000000031'
);

insert into public.payment_provider_accounts (
  id, provider_user_id, provider_name, provider_account_reference,
  access_token_ciphertext, access_token_iv, access_token_auth_tag,
  refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag,
  encryption_key_version, status
) values (
  '11000000-0000-4000-8000-000000000050',
  '11000000-0000-4000-8000-000000000002',
  'MERCADO_PAGO', 'seller-phase11-001',
  'ciphertext-access-phase11', 'iv-access-phase11', 'tag-access-phase11',
  'ciphertext-refresh-phase11', 'iv-refresh-phase11', 'tag-refresh-phase11',
  1, 'CONNECTED'
);

insert into public.payment_checkout_sessions (
  id, request_nonce, purpose, proposal_id, client_user_id, provider_user_id,
  payment_provider_account_id, provider_name, provider_checkout_reference,
  external_reference, amount_minor, marketplace_fee_minor,
  provider_net_expected_minor, currency_code, status, checkout_url
) values
  (
    '11000000-0000-4000-8000-000000000060',
    '11000000-0000-4000-8000-000000000061',
    'PROPOSAL', '11000000-0000-4000-8000-000000000030',
    '11000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000050',
    'MERCADO_PAGO', 'preference-success-001',
    'phase11:proposal:success:001',
    100000, 10000, 90000, 'ARS', 'REDIRECT_READY',
    'https://example.test/checkout/success'
  ),
  (
    '11000000-0000-4000-8000-000000000070',
    '11000000-0000-4000-8000-000000000071',
    'PROPOSAL', '11000000-0000-4000-8000-000000000031',
    '11000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000050',
    'MERCADO_PAGO', 'preference-failure-001',
    'phase11:proposal:failure:001',
    100000, 10000, 90000, 'ARS', 'REDIRECT_READY',
    'https://example.test/checkout/failure'
  );

select set_config('request.jwt.claim.role', 'service_role', true);

select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'PENDING', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  'provider pending verification can create the durable payment attempt'
);

select is(
  (select status::text from public.payment_attempts where proposal_id = '11000000-0000-4000-8000-000000000030'),
  'PENDING',
  'pending reconciliation persists a pending payment attempt'
);
select is(
  (select count(*)::integer from public.jobs where accepted_proposal_version_id = '11000000-0000-4000-8000-000000000040'),
  0,
  'pending payment cannot create a Job'
);
select is(
  (select count(*)::integer from public.financial_ledger_entries where checkout_session_id = '11000000-0000-4000-8000-000000000060'),
  0,
  'pending payment has no terminal financial ledger effects'
);

select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'SUCCEEDED', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  'authoritative pending payment can transition to succeeded'
);

select is(
  (select status::text from public.payment_attempts where proposal_id = '11000000-0000-4000-8000-000000000030'),
  'SUCCEEDED',
  'successful reconciliation makes the durable payment attempt terminal'
);
select is(
  (select status::text from public.proposals where id = '11000000-0000-4000-8000-000000000030'),
  'PAID',
  'successful reconciliation marks the accepted proposal paid'
);
select is(
  (select status::text from public.payment_checkout_sessions where id = '11000000-0000-4000-8000-000000000060'),
  'COMPLETED',
  'successful reconciliation completes the hosted checkout session'
);
select is(
  (select count(*)::integer from public.jobs where accepted_proposal_version_id = '11000000-0000-4000-8000-000000000040'),
  1,
  'successful reconciliation creates exactly one confirmed Job'
);
select is(
  (select count(*)::integer from public.financial_ledger_entries where checkout_session_id = '11000000-0000-4000-8000-000000000060'),
  3,
  'successful reconciliation records exactly three expected financial effects'
);
select ok(
  (
    select count(*) = 3
    from public.financial_ledger_entries
    where checkout_session_id = '11000000-0000-4000-8000-000000000060'
      and (
        (entry_type = 'GROSS_PAYMENT' and party_type = 'CLIENT' and amount_minor = 100000)
        or (entry_type = 'MARKETPLACE_FEE' and party_type = 'MARKETPLACE' and amount_minor = 10000)
        or (entry_type = 'PROVIDER_NET' and party_type = 'PROVIDER' and amount_minor = 90000)
      )
  ),
  'successful payment ledger preserves gross, marketplace fee, and provider net snapshots'
);

select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'SUCCEEDED', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  'replaying the same terminal success is idempotent'
);
select ok(
  (select count(*) = 1 from public.payment_attempts where proposal_id = '11000000-0000-4000-8000-000000000030')
  and (select count(*) = 1 from public.jobs where accepted_proposal_version_id = '11000000-0000-4000-8000-000000000040')
  and (select count(*) = 3 from public.financial_ledger_entries where checkout_session_id = '11000000-0000-4000-8000-000000000060'),
  'terminal success replay cannot duplicate attempt, Job, or ledger effects'
);

select throws_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'FAILED', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  '40001', null,
  'a terminal successful payment cannot contradictorily regress to failed'
);
select throws_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'SUCCEEDED', 99999, 'ARS',
    'seller-phase11-001', null
  )$$,
  '22023', null,
  'reconciliation rejects a provider amount that differs from checkout truth'
);
select throws_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'SUCCEEDED', 100000, 'USD',
    'seller-phase11-001', null
  )$$,
  '22023', null,
  'reconciliation rejects a provider currency that differs from checkout truth'
);
select throws_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000060', 'MERCADO_PAGO',
    'payment-success-001', 'SUCCEEDED', 100000, 'ARS',
    'seller-wrong-999', null
  )$$,
  '42501', null,
  'reconciliation rejects a payment verified against the wrong seller account'
);

select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000070', 'MERCADO_PAGO',
    'payment-failure-001', 'PENDING', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  'second checkout can begin as a pending provider payment'
);
select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000070', 'MERCADO_PAGO',
    'payment-failure-001', 'FAILED', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  'authoritative pending payment can transition to failed'
);
select is(
  (select status::text from public.payment_attempts where proposal_id = '11000000-0000-4000-8000-000000000031'),
  'FAILED',
  'failed reconciliation makes the durable attempt terminal failed'
);
select is(
  (select status::text from public.proposals where id = '11000000-0000-4000-8000-000000000031'),
  'PAYMENT_FAILED',
  'failed reconciliation marks the proposal payment failed'
);
select is(
  (select status::text from public.payment_checkout_sessions where id = '11000000-0000-4000-8000-000000000070'),
  'FAILED',
  'failed reconciliation marks the hosted checkout failed'
);
select is(
  (select count(*)::integer from public.jobs where accepted_proposal_version_id = '11000000-0000-4000-8000-000000000041'),
  0,
  'failed payment cannot create a Job'
);
select is(
  (select count(*)::integer from public.financial_ledger_entries where checkout_session_id = '11000000-0000-4000-8000-000000000070'),
  0,
  'failed payment has no successful charge ledger effects'
);
select lives_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000070', 'MERCADO_PAGO',
    'payment-failure-001', 'FAILED', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  'replaying the same terminal failure is idempotent'
);
select is(
  (select count(*)::integer from public.payment_attempts where proposal_id = '11000000-0000-4000-8000-000000000031'),
  1,
  'terminal failure replay cannot duplicate the payment attempt'
);
select throws_ok(
  $$select * from public.reconcile_provider_payment(
    '11000000-0000-4000-8000-000000000070', 'MERCADO_PAGO',
    'payment-failure-001', 'SUCCEEDED', 100000, 'ARS',
    'seller-phase11-001', null
  )$$,
  '40001', null,
  'a terminal failed payment cannot contradictorily become successful'
);

select * from finish();
rollback;
