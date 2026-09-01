begin;

select plan(4);

select ok(
  to_regprocedure(
    'public.apply_additional_payment_result(uuid,uuid,text,text,public.payment_status,uuid)'
  ) is not null,
  'generic additional payment result RPC exists'
);

select ok(
  coalesce(
    has_function_privilege(
      'service_role',
      to_regprocedure(
        'public.apply_additional_payment_result(uuid,uuid,text,text,public.payment_status,uuid)'
      ),
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
      to_regprocedure(
        'public.apply_additional_payment_result(uuid,uuid,text,text,public.payment_status,uuid)'
      ),
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
