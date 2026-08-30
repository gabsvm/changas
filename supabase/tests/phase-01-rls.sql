begin;

select plan(21);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profile_private'::regclass),
  'profile_private has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.provider_profiles'::regclass),
  'provider_profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.provider_documents'::regclass),
  'provider_documents has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass),
  'user_settings has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass),
  'user_roles has RLS enabled'
);

select ok(
  (select count(*) = 3 from pg_policies
   where schemaname = 'public' and tablename = 'profiles'),
  'profiles has owner select/insert/update policies'
);
select ok(
  (select count(*) = 3 from pg_policies
   where schemaname = 'public' and tablename = 'profile_private'),
  'profile_private has owner select/insert/update policies'
);
select ok(
  (select count(*) = 3 from pg_policies
   where schemaname = 'public' and tablename = 'provider_profiles'),
  'provider_profiles has owner select/insert/update policies'
);
select ok(
  (select count(*) = 4 from pg_policies
   where schemaname = 'public' and tablename = 'provider_documents'),
  'provider_documents has owner CRUD policies'
);
select ok(
  (select count(*) = 3 from pg_policies
   where schemaname = 'public' and tablename = 'user_settings'),
  'user_settings has owner select/insert/update policies'
);
select ok(
  (select count(*) = 1 from pg_policies
   where schemaname = 'public' and tablename = 'user_roles'),
  'user_roles has only owner select policy'
);

select ok(
  not (select public from storage.buckets where id = 'identity-documents'),
  'identity documents bucket is private'
);
select ok(
  (select file_size_limit = 10485760 from storage.buckets where id = 'identity-documents'),
  'identity documents bucket has a 10 MiB limit'
);
select ok(
  (select count(*) = 4 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'identity_documents_%'),
  'identity documents has four folder-scoped policies'
);
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'provider_profiles'
      and policyname = 'provider_profiles_update_own'
      and coalesce(with_check, '') like '%ACTIVE%'
  ),
  'provider owner policy does not allow ACTIVE'
);

select ok(
  (select position('auth.uid()' in coalesce(with_check, '')) > 0
   from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname = 'identity_documents_insert_own'),
  'storage insert policy is authenticated and owner scoped'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where 'anon' = any(roles)
      and (
        (
          schemaname = 'public'
          and tablename in ('profile_private', 'provider_documents')
        )
        or (
          schemaname = 'storage'
          and tablename = 'objects'
          and (
            coalesce(qual, '') like '%identity-documents%'
            or coalesce(with_check, '') like '%identity-documents%'
          )
        )
      )
  ),
  'private identity data has no anon policy'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'phase01-owner@example.com', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Owner"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'phase01-other@example.com', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Other"}'
  );

insert into public.provider_profiles (user_id)
values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

update public.profiles
set bio = 'owner update'
where id = '00000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::integer
   from public.profiles
   where id = '00000000-0000-0000-0000-000000000001'
     and bio = 'owner update'),
  1,
  'owner can update their own profile'
);

update public.profiles
set bio = 'cross-user update'
where id = '00000000-0000-0000-0000-000000000002';

set local role postgres;
select is(
  (select count(*)::integer
   from public.profiles
   where id = '00000000-0000-0000-0000-000000000002'
     and bio = 'cross-user update'),
  0,
  'owner cannot update another profile'
);
set local role authenticated;

select throws_ok(
  $$
    update public.provider_profiles
    set status = 'ACTIVE'
    where user_id = '00000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'owner cannot self-promote provider to ACTIVE'
);

select * from finish();
rollback;
