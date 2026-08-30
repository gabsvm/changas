begin;

select plan(14);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'SELECT, INSERT, UPDATE')
    and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated profiles grant is SELECT/INSERT/UPDATE only'
);
select ok(
  has_table_privilege('authenticated', 'public.profile_private', 'SELECT, INSERT, UPDATE')
    and not has_table_privilege('authenticated', 'public.profile_private', 'DELETE'),
  'authenticated profile_private grant is SELECT/INSERT/UPDATE only'
);
select ok(
  has_table_privilege('authenticated', 'public.provider_profiles', 'SELECT, INSERT, UPDATE')
    and not has_table_privilege('authenticated', 'public.provider_profiles', 'DELETE'),
  'authenticated provider_profiles grant is SELECT/INSERT/UPDATE only'
);
select ok(
  has_table_privilege('authenticated', 'public.provider_documents', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated provider_documents grant is CRUD'
);
select ok(
  has_table_privilege('authenticated', 'public.user_settings', 'SELECT, INSERT, UPDATE')
    and not has_table_privilege('authenticated', 'public.user_settings', 'DELETE'),
  'authenticated user_settings grant is SELECT/INSERT/UPDATE only'
);
select ok(
  has_table_privilege('authenticated', 'public.user_roles', 'SELECT')
    and not has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
    and not has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_roles', 'DELETE'),
  'authenticated user_roles grant is SELECT only'
);

select ok(
  (
    select bool_and(
      has_table_privilege(
        'service_role',
        table_name,
        'SELECT, INSERT, UPDATE, DELETE'
      )
    )
    from (values
      ('public.profiles'),
      ('public.profile_private'),
      ('public.provider_profiles'),
      ('public.provider_documents'),
      ('public.user_settings'),
      ('public.user_roles')
    ) as tables(table_name)
  ),
  'service_role has explicit DML grants on all Phase 01 tables'
);

select ok(
  not exists (
    select 1
    from (values
      ('public.profiles'),
      ('public.profile_private'),
      ('public.provider_profiles'),
      ('public.provider_documents'),
      ('public.user_settings'),
      ('public.user_roles')
    ) as tables(table_name)
    where has_table_privilege('anon', table_name, 'SELECT, INSERT, UPDATE, DELETE')
  ),
  'anon has no Phase 01 table privileges'
);

select ok(
  not exists (
    select 1
    from pg_class as classes
    cross join lateral aclexplode(
      coalesce(classes.relacl, acldefault('r', classes.relowner))
    ) as grants
    where classes.oid in (
      'public.profiles'::regclass,
      'public.profile_private'::regclass,
      'public.provider_profiles'::regclass,
      'public.provider_documents'::regclass,
      'public.user_settings'::regclass,
      'public.user_roles'::regclass
    )
      and grants.grantee = 0
      and grants.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  'PUBLIC has no Phase 01 table privileges'
);

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.profiles'::regclass,
     'public.profile_private'::regclass,
     'public.provider_profiles'::regclass,
     'public.provider_documents'::regclass,
     'public.user_settings'::regclass,
     'public.user_roles'::regclass
   )),
  'all Phase 01 tables retain RLS'
);

select ok(
  (select count(*) = 1
   from pg_policies
   where schemaname = 'public'
     and tablename = 'profiles'
     and policyname = 'profiles_select_own'
     and roles = array['authenticated']::name[]
     and qual like '%auth.uid()%'),
  'profiles select policy remains authenticated owner-only'
);

select ok(
  (select count(*) = 1
   from pg_policies
   where schemaname = 'public'
     and tablename = 'profile_private'
     and policyname = 'profile_private_select_own'
     and roles = array['authenticated']::name[]
     and qual like '%auth.uid()%'),
  'profile_private select policy remains authenticated owner-only'
);

select ok(
  (select count(*) = 1
   from pg_policies
   where schemaname = 'public'
     and tablename = 'provider_profiles'
     and policyname = 'provider_profiles_update_own'
     and roles = array['authenticated']::name[]
     and with_check like '%auth.uid()%'
     and with_check not like '%ACTIVE%'),
  'provider update policy remains owner-only and excludes ACTIVE'
);

select ok(
  (select count(*) = 1
   from pg_policies
   where schemaname = 'public'
     and tablename = 'user_roles'
     and policyname = 'user_roles_select_own'
     and roles = array['authenticated']::name[]
     and qual like '%auth.uid()%'),
  'user_roles remains authenticated owner-select-only'
);

select * from finish();
rollback;
