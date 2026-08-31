begin;

select plan(4);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ),
  'messages is published to Supabase Realtime'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'messages keeps RLS enabled while published'
);

select ok(
  not has_table_privilege('anon', 'public.messages', 'SELECT'),
  'anonymous users cannot read messages'
);

select ok(
  has_table_privilege('authenticated', 'public.messages', 'SELECT'),
  'authenticated role has SELECT subject to participant RLS'
);

select * from finish();
rollback;
