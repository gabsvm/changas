begin;

select plan(30);

select ok(
  has_table_privilege('anon', 'public.categories', 'SELECT')
    and has_table_privilege('authenticated', 'public.categories', 'SELECT')
    and not has_table_privilege('anon', 'public.categories', 'INSERT, UPDATE, DELETE')
    and not has_table_privilege('authenticated', 'public.categories', 'INSERT, UPDATE, DELETE'),
  'catalog categories expose read-only SELECT grants'
);
select ok(
  has_table_privilege('anon', 'public.skills', 'SELECT')
    and has_table_privilege('authenticated', 'public.skills', 'SELECT')
    and not has_table_privilege('anon', 'public.skills', 'INSERT, UPDATE, DELETE')
    and not has_table_privilege('authenticated', 'public.skills', 'INSERT, UPDATE, DELETE'),
  'catalog skills expose read-only SELECT grants'
);
select ok(
  has_table_privilege('anon', 'public.skill_synonyms', 'SELECT')
    and has_table_privilege('authenticated', 'public.skill_synonyms', 'SELECT')
    and not has_table_privilege('anon', 'public.skill_synonyms', 'INSERT, UPDATE, DELETE')
    and not has_table_privilege('authenticated', 'public.skill_synonyms', 'INSERT, UPDATE, DELETE'),
  'skill synonyms expose read-only SELECT grants'
);

select ok(
  (select bool_and(has_table_privilege('anon', view_name, 'SELECT'))
   from (values
     ('public.public_provider_profiles'),
     ('public.public_provider_skills'),
     ('public.public_provider_services'),
     ('public.public_service_tags'),
     ('public.public_provider_experiences'),
     ('public.public_provider_education'),
     ('public.public_provider_certifications'),
     ('public.public_provider_portfolio'),
     ('public.public_provider_service_areas')
   ) as views(view_name)),
  'anonymous has SELECT only on explicit public projections'
);
select ok(
  (select bool_and(has_table_privilege('authenticated', view_name, 'SELECT'))
   from (values
     ('public.public_provider_profiles'),
     ('public.public_provider_skills'),
     ('public.public_provider_services'),
     ('public.public_service_tags'),
     ('public.public_provider_experiences'),
     ('public.public_provider_education'),
     ('public.public_provider_certifications'),
     ('public.public_provider_portfolio'),
     ('public.public_provider_service_areas')
   ) as views(view_name)),
  'authenticated has SELECT only on explicit public projections'
);

select ok(
  (select bool_and(
    not has_table_privilege('anon', table_name, 'SELECT, INSERT, UPDATE, DELETE')
    and not has_table_privilege('authenticated', table_name, 'SELECT, INSERT, UPDATE, DELETE')
  )
  from (values
    ('public.provider_skills'),
    ('public.services'),
    ('public.service_tags'),
    ('public.experiences'),
    ('public.education'),
    ('public.certifications'),
    ('public.portfolio_items'),
    ('public.service_areas'),
    ('public.availability_rules'),
    ('public.availability_blocks')
  ) as tables(table_name)),
  'anonymous has no direct grants on provider-owned Phase 02 tables'
);

select ok(
  has_table_privilege('authenticated', 'public.provider_skills', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage provider_skills'
);
select ok(
  has_table_privilege('authenticated', 'public.services', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage services'
);
select ok(
  has_table_privilege('authenticated', 'public.service_tags', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage service_tags'
);
select ok(
  has_table_privilege('authenticated', 'public.experiences', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage experiences'
);
select ok(
  has_table_privilege('authenticated', 'public.education', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage education'
);
select ok(
  has_table_privilege('authenticated', 'public.certifications', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage certifications'
);
select ok(
  has_table_privilege('authenticated', 'public.portfolio_items', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage portfolio_items'
);
select ok(
  has_table_privilege('authenticated', 'public.service_areas', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage service_areas'
);
select ok(
  has_table_privilege('authenticated', 'public.availability_rules', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage availability_rules'
);
select ok(
  has_table_privilege('authenticated', 'public.availability_blocks', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated can manage availability_blocks'
);

select ok(
  (select bool_and(has_table_privilege('service_role', table_name, 'SELECT, INSERT, UPDATE, DELETE'))
   from (values
     ('public.categories'),
     ('public.skills'),
     ('public.skill_synonyms'),
     ('public.provider_skills'),
     ('public.services'),
     ('public.service_tags'),
     ('public.experiences'),
     ('public.education'),
     ('public.certifications'),
     ('public.portfolio_items'),
     ('public.service_areas'),
     ('public.availability_rules'),
     ('public.availability_blocks')
   ) as tables(table_name)),
  'service_role has explicit DML grants for server-side operations'
);

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.provider_skills'::regclass,
     'public.services'::regclass,
     'public.service_tags'::regclass,
     'public.experiences'::regclass,
     'public.education'::regclass,
     'public.certifications'::regclass,
     'public.portfolio_items'::regclass,
     'public.service_areas'::regclass,
     'public.availability_rules'::regclass,
     'public.availability_blocks'::regclass
   )),
  'all provider-owned Phase 02 tables retain RLS'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name like 'public_provider_%'
      and column_name in (
        'exact_address', 'private_phone', 'date_of_birth', 'dni_number',
        'center', 'latitude', 'longitude', 'evidence_path'
      )
  ),
  'public projections exclude private identity and exact location fields'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('public_provider_certifications', 'public_provider_portfolio')
      and column_name in ('evidence_path', 'evidence_mime_type', 'evidence_file_size_bytes')
  ),
  'public projections exclude certification evidence metadata'
);

select ok(
  (select count(*) = 4
   from pg_policies
   where schemaname = 'public' and tablename = 'provider_skills'
     and roles = array['authenticated']::name[]),
  'provider_skills has owner select/insert/update/delete policies'
);
select ok(
  (select count(*) = 4
   from pg_policies
   where schemaname = 'public' and tablename = 'services'
     and roles = array['authenticated']::name[]),
  'services has owner CRUD policies'
);
select ok(
  (select count(*) = 4
   from pg_policies
   where schemaname = 'public' and tablename = 'certifications'
     and roles = array['authenticated']::name[]),
  'certifications has owner CRUD policies'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE')
    and not has_function_privilege('anon', 'private.activate_provider_for_test(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.activate_provider_for_test(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.activate_provider_for_test(uuid)', 'EXECUTE'),
  'test activation function is not callable by client roles'
);

select ok(
  (select public from storage.buckets where id = 'provider-certification-evidence') is false
    and (select file_size_limit from storage.buckets where id = 'provider-certification-evidence') = 10485760,
  'certification evidence bucket is private and limited to 10 MiB'
);
select ok(
  (select public from storage.buckets where id = 'provider-portfolio') is false
    and (select file_size_limit from storage.buckets where id = 'provider-portfolio') = 5242880,
  'portfolio bucket is private and limited to 5 MiB'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'provider_certification_evidence_%'
      and 'anon' = any(roles)
  ),
  'anonymous users have no certification evidence Storage policy'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'provider_portfolio_select_public'
      and 'anon' = any(roles)
  ),
  'portfolio reads are explicitly limited to public projection objects'
);

select ok(
  (select count(*) >= 7 from public.categories where is_active),
  'initial catalog contains the seven representative categories'
);
select ok(
  (select count(*) >= 12 from public.skills where is_active),
  'initial catalog contains a limited but useful skill set'
);

select * from finish();
rollback;
