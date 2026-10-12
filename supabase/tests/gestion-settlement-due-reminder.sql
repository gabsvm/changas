begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'materialize_due_settlement_reminders'
  ),
  'settlement reminder materializer exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'materialize_due_settlement_reminders'
      and p.prosecdef
  ),
  'settlement reminder materializer is security definer'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.materialize_due_settlement_reminders(timestamptz)',
    'EXECUTE'
  ),
  'service role can materialize settlement reminders'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.materialize_due_settlement_reminders(timestamptz)',
    'EXECUTE'
  ),
  'authenticated users cannot materialize settlement reminders'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.materialize_due_settlement_reminders(timestamptz)',
    'EXECUTE'
  ),
  'anonymous users cannot materialize settlement reminders'
);

select * from finish();
rollback;
