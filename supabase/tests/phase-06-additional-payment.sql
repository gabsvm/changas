begin;

select plan(4);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_additional_payment_result'
  ),
  'generic additional payment result RPC exists'
);

select ok(
  coalesce(
    has_function_privilege(
      'service_role',
      'public.apply_additional_payment_result(uuid,uuid,text,text,public.payment_status,uuid)',
      'EXECUTE'
    ),
    false
  ),
  'service_role can execute generic additional payment result RPC'
);

select ok(
  not coalesce(
    has_function_privilege(
      'authenticated',
      'public.apply_additional_payment_result(uuid,uuid,text,text,public.payment_status,uuid)',
      'EXECUTE'
    ),
    false
  ),
  'authenticated cannot execute generic additional payment result RPC'
);

select ok(
  not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.job_additional_payment_attempts'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%FAKE%'
  ),
  'additional payment provider constraint is provider-agnostic'
);

select * from finish();
rollback;
