-- YALO B3 mínimo: filtros/cursor en listados de trabajos + agregado de no leídos.
begin;

select plan(12);

select ok(
  to_regprocedure('public.list_my_upcoming_jobs(integer,text,timestamp with time zone,uuid)') is not null,
  'upcoming jobs accept status filter and keyset cursor'
);
select ok(
  to_regprocedure('public.list_my_past_jobs(integer,text,timestamp with time zone,uuid)') is not null,
  'past jobs accept status filter and keyset cursor'
);
select ok(
  to_regprocedure('public.get_my_unread_conversation_count()') is not null,
  'unread conversation aggregate exists'
);

select ok(
  not has_function_privilege('anon', 'public.list_my_upcoming_jobs(integer,text,timestamp with time zone,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_my_upcoming_jobs(integer,text,timestamp with time zone,uuid)', 'EXECUTE'),
  'upcoming jobs stay authenticated-only'
);
select ok(
  not has_function_privilege('anon', 'public.list_my_past_jobs(integer,text,timestamp with time zone,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_my_past_jobs(integer,text,timestamp with time zone,uuid)', 'EXECUTE'),
  'past jobs stay authenticated-only'
);
select ok(
  not has_function_privilege('anon', 'public.get_my_unread_conversation_count()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_my_unread_conversation_count()', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_my_unread_conversation_count()', 'EXECUTE'),
  'unread aggregate stays out of anonymous reach'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_my_unread_conversation_count()')))
  like '%SECURITY DEFINER%',
  'unread aggregate runs as definer like its sisters'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_my_unread_conversation_count()')))
  like '%conversation_reads%',
  'unread aggregate honors read cursors'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.list_my_upcoming_jobs(integer,text,timestamp with time zone,uuid)')))
  like '%COMPLETION_REQUESTED%',
  'upcoming filter covers closing states'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.list_my_past_jobs(integer,text,timestamp with time zone,uuid)')))
  like '%PENDING_SETTLEMENT%',
  'past filter covers pending settlement'
);
select ok(
  (select proargnames::text from pg_proc where oid = to_regprocedure('public.list_my_upcoming_jobs(integer,text,timestamp with time zone,uuid)'))
  like '%sort_key%',
  'upcoming jobs expose a pagination sort key'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.list_my_upcoming_jobs(integer,text,timestamp with time zone,uuid)')))
  like '%status_filter is null%',
  'unknown or missing filter never yields false empties'
);

rollback;
