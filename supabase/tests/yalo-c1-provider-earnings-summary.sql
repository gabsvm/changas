-- YALO C1 mínimo: agregado de ingresos del proveedor.
begin;

select plan(8);

select ok(
  to_regprocedure('public.get_provider_earnings_summary()') is not null,
  'provider earnings aggregate exists'
);

select ok(
  not has_function_privilege('anon', 'public.get_provider_earnings_summary()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_provider_earnings_summary()', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_provider_earnings_summary()', 'EXECUTE'),
  'earnings aggregate stays out of anonymous reach'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_provider_earnings_summary()')))
  like '%SECURITY DEFINER%',
  'earnings aggregate runs as definer like its sisters'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_provider_earnings_summary()')))
  like '%job_is_settled%',
  'earned only counts settled jobs'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_provider_earnings_summary()')))
  like '%settled_amount_for_job%',
  'earned uses immutable settled amounts, not base plus current unpaid'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_provider_earnings_summary()')))
  like '%''FAKE''%',
  'simulated settlements stay separate from real ones'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_provider_earnings_summary()')))
  not like '%LIMIT%',
  'earnings aggregate has no arbitrary row cap'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_provider_earnings_summary()')))
  like '%unpaid_scope_additional_for_job%',
  'pending uses base plus unpaid extras'
);

rollback;
