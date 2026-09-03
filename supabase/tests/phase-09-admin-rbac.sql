begin;

select plan(17);

select ok(to_regclass('public.admin_audit_events') is not null, 'admin audit events table exists');

select ok(
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'admin_audit_events'
  ), false),
  'admin audit events keep RLS enabled'
);

select ok(
  coalesce((
    select not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'admin_audit_events'
  ), false),
  'browser roles have no direct audit table access'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_current_user_admin'
  ),
  'is_current_user_admin exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'require_admin'
  ),
  'require_admin exists'
);

select ok(
  coalesce((
    select bool_and(
      not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'require_admin'
    having count(*) >= 1
  ), false),
  'require_admin is private to server-side callers'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_admin_users'
  ),
  'list_admin_users exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_admin_user_detail'
  ),
  'get_admin_user_detail exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_admin_providers'
  ),
  'list_admin_providers exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_admin_provider_detail'
  ),
  'get_admin_provider_detail exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_admin_jobs'
  ),
  'list_admin_jobs exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_admin_job_detail'
  ),
  'get_admin_job_detail exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_admin_audit_events'
  ),
  'list_admin_audit_events exists'
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
        'is_current_user_admin',
        'list_admin_users',
        'get_admin_user_detail',
        'list_admin_providers',
        'get_admin_provider_detail',
        'list_admin_jobs',
        'get_admin_job_detail',
        'list_admin_audit_events'
      )
    having count(*) = 8
  ), false),
  'admin browser RPC entrypoints require an authenticated session'
);

select ok(
  exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'admin'
  ),
  'existing role model contains admin'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'admin_audit_events'
      and indexname = 'admin_audit_events_created_idx'
  ),
  'audit log is indexed for bounded recent inspection'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_audit_events'
      and column_name in ('document_body', 'identity_document', 'secret', 'token')
  ),
  'audit table contains no obvious secret/document-content columns'
);

select * from finish();
rollback;