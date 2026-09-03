begin;

select plan(21);

select ok(
  to_regclass('public.service_moderation_state') is not null,
  'service moderation current state table exists'
);

select ok(
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'service_moderation_state'
  ), false),
  'service moderation state keeps RLS enabled'
);

select ok(
  coalesce((
    select not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'service_moderation_state'
  ), false),
  'browser roles have no direct service moderation state access'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_moderation_state'
      and column_name = 'state'
  ),
  'service moderation records state'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_moderation_state'
      and column_name = 'reason'
  ),
  'service moderation records reason'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_moderation_state'
      and column_name = 'updated_by'
  ),
  'service moderation records admin actor'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_moderation_state'
      and column_name = 'provider_paused_snapshot'
  ),
  'service moderation preserves provider pause state for reversible disable'
);

select ok(
  coalesce((
    select bool_or(
      pg_get_constraintdef(c.oid) like '%CLEAR%'
      and pg_get_constraintdef(c.oid) like '%FLAGGED%'
      and pg_get_constraintdef(c.oid) like '%DISABLED%'
    )
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'service_moderation_state'
      and c.contype = 'c'
  ), false),
  'service moderation state is constrained to CLEAR FLAGGED DISABLED'
);

select ok(
  coalesce((
    select bool_or(c.contype = 'p' and array_length(c.conkey, 1) = 1)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'service_moderation_state'
  ), false),
  'service moderation keeps one current row per service'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_create_category'),
  'admin_create_category exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_update_category'),
  'admin_update_category exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_delete_category'),
  'admin_delete_category exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_create_skill'),
  'admin_create_skill exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_update_skill'),
  'admin_update_skill exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_delete_skill'),
  'admin_delete_skill exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_create_skill_synonym'),
  'admin_create_skill_synonym exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_update_skill_synonym'),
  'admin_update_skill_synonym exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_delete_skill_synonym'),
  'admin_delete_skill_synonym exists'
);

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'admin_set_service_moderation'),
  'admin_set_service_moderation exists'
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
        'admin_create_category',
        'admin_update_category',
        'admin_delete_category',
        'admin_create_skill',
        'admin_update_skill',
        'admin_delete_skill',
        'admin_create_skill_synonym',
        'admin_update_skill_synonym',
        'admin_delete_skill_synonym',
        'admin_set_service_moderation'
      )
    having count(*) = 10
  ), false),
  'catalog moderation RPC entrypoints are authenticated-only'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'services'
      and t.tgname = 'services_moderation_pause_guard'
      and not t.tgisinternal
  ),
  'disabled services have a database pause guard against provider bypass'
);

select * from finish();
rollback;