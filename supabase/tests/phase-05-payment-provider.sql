begin;

select plan(3);

select has_function(
  'public',
  'apply_payment_result',
  array['uuid', 'uuid', 'text', 'text', 'public.payment_status', 'uuid'],
  'generic payment result RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    to_regprocedure('public.apply_payment_result(uuid,uuid,text,text,public.payment_status,uuid)'),
    'EXECUTE'
  ),
  'service_role can execute generic payment result RPC'
);

select ok(
  not coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.apply_payment_result(uuid,uuid,text,text,public.payment_status,uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users cannot execute generic payment result RPC'
);

select * from finish();

rollback;
