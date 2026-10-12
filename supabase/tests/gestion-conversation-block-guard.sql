begin;

select plan(5);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'start_service_conversation'
  ),
  'conversation start exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'start_service_conversation'
      and p.prosecdef
  ),
  'conversation start is security definer'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.start_service_conversation(text, text)',
    'EXECUTE'
  ),
  'authenticated users can start conversations'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.start_service_conversation(text, text)',
    'EXECUTE'
  ),
  'anonymous users cannot start conversations'
);

select ok(
  pg_get_functiondef(
    'public.start_service_conversation(text, text)'::regprocedure
  ) like '%user_blocks%',
  'conversation start enforces the pair block guard'
);

select * from finish();
rollback;
