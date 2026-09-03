begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_notification_deliveries_v2'
  ),
  'delivery claim v2 exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_notification_deliveries_v2'
      and p.prosecdef
  ),
  'delivery claim v2 is security definer'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_notification_deliveries_v2(integer,integer)',
    'EXECUTE'
  ),
  'service role can claim delivery v2 rows'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_notification_deliveries_v2(integer,integer)',
    'EXECUTE'
  ),
  'authenticated users cannot claim delivery v2 rows'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_notification_deliveries_v2(integer,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot claim delivery v2 rows'
);

select * from finish();
rollback;
