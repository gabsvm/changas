begin;

select plan(16);

select ok(
  to_regclass('public.provider_identity_reviews') is not null,
  'provider identity review history table exists'
);

select ok(
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'provider_identity_reviews'
  ), false),
  'provider identity review history keeps RLS enabled'
);

select ok(
  coalesce((
    select not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'provider_identity_reviews'
  ), false),
  'browser roles have no direct identity review history access'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'provider_identity_reviews'
      and indexname = 'provider_identity_reviews_provider_created_idx'
  ),
  'identity review history is indexed by provider and time'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_identity_reviews'
      and column_name = 'reviewer_user_id'
  ),
  'identity review records reviewer actor'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_identity_reviews'
      and column_name = 'previous_status'
  ),
  'identity review preserves previous provider status'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_identity_reviews'
      and column_name = 'new_status'
  ),
  'identity review preserves new provider status'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_identity_reviews'
      and column_name = 'reason'
  ),
  'identity review stores decision reason'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_admin_identity_queue'
  ),
  'list_admin_identity_queue exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_admin_identity_case'
  ),
  'get_admin_identity_case exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'decide_provider_identity_review'
  ),
  'decide_provider_identity_review exists'
);

select ok(
  coalesce((
    select bool_and(
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_admin_identity_queue',
        'get_admin_identity_case',
        'decide_provider_identity_review'
      )
    having count(*) = 3
  ), false),
  'identity review RPC entrypoints are authenticated-only'
);

select ok(
  not has_table_privilege('authenticated', 'public.provider_documents', 'SELECT')
    or exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'provider_documents'
        and policyname = 'provider_documents_select_own'
    ),
  'provider document metadata remains owner-scoped at browser table boundary'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'identity-documents' and public = false
  ),
  'identity document storage bucket remains private'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname ilike '%admin%identity%'
  ),
  'admin review does not weaken private storage with a broad browser RLS policy'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_identity_reviews'
      and not t.tgisinternal
  ),
  'identity review history has an immutability guard'
);

select * from finish();
rollback;