begin;

select plan(8);

select ok(
  to_regprocedure('public.get_my_payment_receipt(uuid)') is not null
  and to_regprocedure('public.list_admin_payment_finance(integer,integer)') is not null
  and to_regprocedure('public.list_admin_payment_reconciliation_runs(integer)') is not null,
  'participant receipt and admin payment read models exist'
);

select ok(
  to_regprocedure('public.list_payment_reconciliation_candidates(text,timestamptz,timestamptz)') is not null
  and to_regprocedure('public.record_payment_reconciliation_observation(uuid,public.payment_status,text,bigint,text,text,bigint,bigint)') is not null,
  'server reconciliation candidate and observation RPCs exist'
);

select ok(
  to_regprocedure('public.reconcile_provider_payment(uuid,text,text,public.payment_status,bigint,text,text,uuid)') is not null
  and to_regprocedure('public.reconcile_provider_proposal_payment(uuid,text,text,public.payment_status,bigint,text,text,uuid)') is not null,
  'provider reconciliation keeps the proposal implementation behind the purpose-aware wrapper'
);

select ok(
  has_function_privilege('authenticated', 'public.get_my_payment_receipt(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_my_payment_receipt(uuid)', 'EXECUTE'),
  'payment receipts require an authenticated participant'
);

select ok(
  has_function_privilege('authenticated', 'public.list_admin_payment_finance(integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_admin_payment_reconciliation_runs(integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_admin_payment_finance(integer,integer)', 'EXECUTE'),
  'admin finance entrypoints require authenticated sessions before RBAC evaluation'
);

select ok(
  has_function_privilege('service_role', 'public.list_payment_reconciliation_candidates(text,timestamptz,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.list_payment_reconciliation_candidates(text,timestamptz,timestamptz)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_payment_reconciliation_candidates(text,timestamptz,timestamptz)', 'EXECUTE'),
  'sensitive reconciliation candidates remain server-only'
);

select ok(
  has_function_privilege('service_role', 'public.record_payment_reconciliation_observation(uuid,public.payment_status,text,bigint,text,text,bigint,bigint)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.record_payment_reconciliation_observation(uuid,public.payment_status,text,bigint,text,text,bigint,bigint)', 'EXECUTE'),
  'provider observations can only be persisted by the server'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payment_settlements'
      and column_name = 'provider_payment_status'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payment_settlements'
      and column_name = 'reconciliation_mismatch'
  ),
  'settlements persist provider observation and mismatch state'
);

select * from finish();
rollback;
