begin;

select plan(45);

select ok(
  to_regprocedure('public.normalize_search_text(text)') is not null,
  'PostgreSQL exposes the deterministic discovery normalizer'
);
select is(
  public.normalize_search_text('  ClÁSES   de Inglés '),
  'clases de ingles',
  'normalization handles Spanish case, accents, and whitespace'
);
select ok(
  to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)') is not null,
  'discovery has one bounded server-side RPC'
);
select ok(
  to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)') is not null,
  'discovery v2 exposes the paginated audit-hardened contract'
);
select ok(
  has_function_privilege('anon', 'public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)', 'EXECUTE'),
  'anon can execute only the safe discovery RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)', 'EXECUTE'),
  'authenticated can execute the safe discovery RPC'
);
select ok(
  has_function_privilege('anon', 'public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)', 'EXECUTE')
    and not has_function_privilege('public', 'public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)', 'EXECUTE'),
  'v2 grants execution only to explicit API roles'
);
select ok(
  not exists (
    select 1
    from pg_proc as routines
    cross join lateral aclexplode(
      coalesce(routines.proacl, acldefault('f', routines.proowner))
    ) as grants
    where routines.oid = to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)')
      and grants.grantee = 0
      and grants.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no implicit discovery execution privilege'
);

select ok(
  to_regclass('public.provider_favorites') is not null,
  'provider favorites have a dedicated table'
);
select ok(
  not has_table_privilege('anon', 'public.provider_favorites', 'SELECT, INSERT, UPDATE, DELETE')
    and not has_table_privilege('authenticated', 'public.provider_favorites', 'UPDATE'),
  'anon has no favorite access and authenticated cannot update favorite ownership'
);
select ok(
  has_table_privilege('authenticated', 'public.provider_favorites', 'SELECT')
    and not has_table_privilege('authenticated', 'public.provider_favorites', 'INSERT')
    and not has_table_privilege('authenticated', 'public.provider_favorites', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.provider_favorites', 'DELETE')
    and has_table_privilege('service_role', 'public.provider_favorites', 'SELECT, INSERT, UPDATE, DELETE'),
  'favorite grants expose only authenticated reads and service-role administration'
);
select ok(
  has_function_privilege('authenticated', 'public.set_provider_favorite(text, boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.set_provider_favorite(text, boolean)', 'EXECUTE'),
  'favorite writes are authenticated-only'
);
select ok(
  has_function_privilege('authenticated', 'public.list_my_favorite_providers()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_my_favorite_providers()', 'EXECUTE'),
  'favorite reads are authenticated-only'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.provider_favorites'::regclass),
  'favorite table keeps RLS enabled'
);
select ok(
  (select count(*) = 1
   from pg_policies
   where schemaname = 'public'
     and tablename = 'provider_favorites'
     and roles = array['authenticated']::name[]
     and policyname = 'provider_favorites_select_own'),
  'favorites have only an authenticated owner-only read policy'
);

select ok(
  to_regclass('public.services_search_document_gin_idx') is not null,
  'services have a GIN full-text index'
);
select ok(
  to_regclass('public.services_search_text_trgm_idx') is not null,
  'services have a trigram fuzzy-search index'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'services_search_text_trgm_idx'
      and indexdef like '%search_text_normalized%'
  ),
  'trigram fuzzy predicate uses the stored normalized search expression'
);
select ok(
  to_regclass('public.service_areas_center_gist_idx') is not null,
  'radius matching retains the service-area geography GiST index'
);
select ok(
  to_regclass('public.service_areas_public_search_center_gist_idx') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'service_areas'
        and column_name = 'public_search_center'
    ),
  'public discovery has a separate coarse geography and GiST index'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'search_document'
  ),
  'services persist a weighted full-text document'
);
select ok(
  pg_get_function_result(
    to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)')
  ) not like '%center%'
    and pg_get_function_result(
      to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)')
    ) not like '%private_phone%'
    and pg_get_function_result(
      to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)')
    ) not like '%dni%',
  'discovery result type excludes exact coordinates and private identity fields'
);
select ok(
  pg_get_function_result(
    to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)')
  ) like '%distance_bucket%'
    and pg_get_function_result(
      to_regprocedure('public.search_discovery_services_v3(text,text,text,public.service_modality,bigint,bigint,boolean,public.price_model,numeric,numeric,integer,text,integer,integer)')
    ) not like '%distance_meters%',
  'public discovery exposes only coarse distance buckets'
);
select throws_ok(
  $$select * from public.search_discovery_services_v3(null, null, null, null, null, null, null, null, 91, 0, null, 'recommended', 1, 24)$$,
  '22023',
  null,
  'invalid discovery latitude is rejected'
);
select throws_ok(
  $$select * from public.search_discovery_services_v3(null, null, null, null, null, null, null, null, 0, null, null, 'recommended', 1, 24)$$,
  '22023',
  null,
  'incomplete discovery point is rejected'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '03300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase03-pgtap-a@example.test', 'not-a-real-password', now(), now(), now(), '{}', '{"display_name":"PGTAP A"}'),
  ('00000000-0000-0000-0000-000000000000', '03300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase03-pgtap-b@example.test', 'not-a-real-password', now(), now(), now(), '{}', '{"display_name":"PGTAP B"}'),
  ('00000000-0000-0000-0000-000000000000', '03300000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'phase03-pgtap-c@example.test', 'not-a-real-password', now(), now(), now(), '{}', '{"display_name":"PGTAP C"}');

insert into public.provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
values
  ('03300000-0000-4000-8000-000000000001', 'ACTIVE', 4, 'pgtap-discovery-a', 'PGTAP discovery A'),
  ('03300000-0000-4000-8000-000000000002', 'PROFILE_INCOMPLETE', 1, 'pgtap-discovery-b', 'PGTAP discovery B'),
  ('03300000-0000-4000-8000-000000000003', 'ACTIVE', 4, 'pgtap-discovery-c', 'PGTAP discovery C');

insert into public.provider_skills (provider_user_id, skill_id)
select '03300000-0000-4000-8000-000000000001', id
from public.skills
where slug in ('reparacion-pc', 'electricista', 'ingles-conversacional', 'instalacion-camaras');
insert into public.provider_skills (provider_user_id, skill_id)
select '03300000-0000-4000-8000-000000000002', id
from public.skills
where slug = 'instalacion-camaras';
insert into public.provider_skills (provider_user_id, skill_id)
select '03300000-0000-4000-8000-000000000003', id
from public.skills
where slug = 'electricista';

insert into public.services (
  provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, accepts_offers,
  schedule_type, is_published
)
select
  '03300000-0000-4000-8000-000000000001',
  s.id,
  values_data.public_slug,
  values_data.title,
  values_data.description,
  values_data.modality::public.service_modality,
  values_data.price_model::public.price_model,
  values_data.price_amount,
  'ARS',
  values_data.accepts_offers,
  'UNSCHEDULED',
  true
from public.skills s
join (values
  ('reparacion-pc', 'pgtap-pc', 'Arreglar PC que se apaga', 'Servicio sintético para arreglar una PC que se apaga.', 'REMOTE', 'FIXED', 100000, true),
  ('electricista', 'pgtap-electricista', 'Electricista del hogar', 'Servicio sintético de electricista para instalaciones seguras.', 'IN_PERSON', 'FIXED', 200000, true),
  ('ingles-conversacional', 'pgtap-ingles', 'Clases de inglés', 'Clases sintéticas de inglés conversacional a distancia.', 'REMOTE', 'HOURLY', 300000, true),
  ('instalacion-camaras', 'pgtap-camara', 'Instalar cámara', 'Servicio sintético para instalar una cámara en el hogar.', 'BOTH', 'FIXED', 400000, false)
) as values_data(skill_slug, public_slug, title, description, modality, price_model, price_amount, accepts_offers)
  on values_data.skill_slug = s.slug
where s.is_active;

insert into public.services (
  provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, schedule_type, is_published
)
select
  '03300000-0000-4000-8000-000000000002',
  s.id,
  'pgtap-inactive-area',
  'Cámara en área inactiva',
  'Servicio sintético para comprobar que el área inactiva no aparece.',
  'IN_PERSON',
  'FIXED',
  500000,
  'ARS',
  'UNSCHEDULED',
  false
from public.skills s
where s.slug = 'instalacion-camaras';

insert into public.services (
  provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, accepts_offers,
  schedule_type, is_published
)
select
  '03300000-0000-4000-8000-000000000003',
  s.id,
  'pgtap-cobertura',
  'Cobertura de área',
  'Servicio sintético para validar el radio de cobertura del proveedor.',
  'IN_PERSON',
  'FIXED',
  900000,
  'ARS',
  true,
  'UNSCHEDULED',
  true
from public.skills s
where s.slug = 'electricista';

insert into public.service_tags (service_id, tag)
select id, 'instalar camara'
from public.services
where public_slug = 'pgtap-camara';

insert into public.service_areas (provider_user_id, label, center, radius_meters, is_active)
values
  ('03300000-0000-4000-8000-000000000001', 'Área cercana', extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.58), 4326)::extensions.geography, 5000, true),
  ('03300000-0000-4000-8000-000000000001', 'Área lejana', extensions.st_setsrid(extensions.st_makepoint(-58.60, -34.70), 4326)::extensions.geography, 5000, true),
  ('03300000-0000-4000-8000-000000000002', 'Área apagada', extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.58), 4326)::extensions.geography, 5000, false),
  ('03300000-0000-4000-8000-000000000003', 'Cobertura variable', extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.76), 4326)::extensions.geography, 5000, true);

select ok(
  exists (select 1 from public.search_discovery_services_v3('electricista', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)),
  'electricista returns a controlled catalog result'
);
select ok(
  exists (select 1 from public.search_discovery_services_v3('arreglar pc', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)),
  'arreglar pc resolves through a curated synonym'
);
select ok(
  exists (select 1 from public.search_discovery_services_v3('pc se apaga', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)),
  'pc se apaga resolves through a curated synonym'
);
select ok(
  exists (select 1 from public.search_discovery_services_v3('clases ingles', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)),
  'clases ingles resolves through a curated synonym'
);
select ok(
  exists (select 1 from public.search_discovery_services_v3('instalar camara', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)),
  'instalar camara resolves through tags and synonyms'
);
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3(null, null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24) result
    where result.provider_slug = 'pgtap-discovery-b'
  ),
  'public search excludes no-longer eligible provider data'
);

update public.services
set is_paused = true
where public_slug = 'pgtap-pc';
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3('arreglar pc', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)
  ),
  'paused services are excluded'
);
update public.services set is_paused = false where public_slug = 'pgtap-pc';

update public.skills
set is_active = false
where slug = 'electricista';
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3('electricista', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24)
  ),
  'inactive skills are excluded'
);
update public.skills set is_active = true where slug = 'electricista';

select ok(
  exists (
    select 1
    from public.search_discovery_services_v3(null, null, null, 'REMOTE'::public.service_modality, null, null, null, null, -34.8, -58.8, 1000, 'recommended', 1, 24)
    where service_slug in ('pgtap-pc', 'pgtap-ingles', 'pgtap-camara')
  ),
  'remote mode includes remote and BOTH offerings without a location dependency'
);
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3(null, null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.8, -58.8, 1000, 'recommended', 1, 24)
    where service_slug in ('pgtap-pc', 'pgtap-ingles')
  ),
  'in-person mode excludes remote-only offerings outside a radius'
);
select ok(
  exists (
    select 1
    from public.search_discovery_services_v3('electricista', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.58, -58.43, 1000, 'nearest', 1, 24)
    where service_slug = 'pgtap-electricista'
      and distance_bucket = 'UNDER_2_KM'
  ),
  'inside-radius matching returns approximate distance'
);
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3('electricista', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.8, -58.8, 1000, 'nearest', 1, 24)
    where service_slug = 'pgtap-electricista'
  ),
  'outside-radius matching excludes in-person offerings'
);
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3('cobertura', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.58, -58.43, 25000, 'nearest', 1, 24)
    where service_slug = 'pgtap-cobertura'
  ),
  'provider coverage radius excludes a center inside the client radius but outside the provider radius'
);
update public.service_areas
set center = extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.616), 4326)::extensions.geography,
    radius_meters = 5000
where provider_user_id = '03300000-0000-4000-8000-000000000003';
select ok(
  exists (
    select 1
    from public.search_discovery_services_v3('cobertura', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.58, -58.43, 10000, 'nearest', 1, 24)
    where service_slug = 'pgtap-cobertura'
  ),
  'provider coverage radius allows a point inside both provider and client radii'
);
update public.service_areas
set center = extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.652), 4326)::extensions.geography,
    radius_meters = 10000
where provider_user_id = '03300000-0000-4000-8000-000000000003';
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3('cobertura', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.58, -58.43, 5000, 'nearest', 1, 24)
    where service_slug = 'pgtap-cobertura'
  ),
  'client discovery radius remains an independent upper bound'
);
update public.provider_profiles
set status = 'ACTIVE'
where public_slug = 'pgtap-discovery-b';
update public.services
set is_published = true
where public_slug = 'pgtap-inactive-area';
select ok(
  exists (
    select 1
    from public.search_discovery_services_v3('instalar camara', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.58, -58.43, 1000, 'nearest', 1, 24)
    where service_slug = 'pgtap-camara'
      and distance_bucket = 'UNDER_2_KM'
  )
  and not exists (
    select 1
    from public.search_discovery_services_v3('instalar camara', null, null, 'IN_PERSON'::public.service_modality, null, null, null, null, -34.58, -58.43, 1000, 'nearest', 1, 24)
    where service_slug = 'pgtap-inactive-area'
  ),
  'multiple areas use an active area and ignore an inactive area'
);
select ok(
  not exists (
    select 1
    from public.search_discovery_services_v3('instalar camara', null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 24) result
    where to_jsonb(result) ? 'center'
      or to_jsonb(result) ? 'service_area_center'
  ),
  'public result rows never include service-area coordinates'
);
select ok(
  exists (
    select 1
    from public.search_discovery_services_v3(null, null, null, null, 150000, 350000, true, null, null, null, null, 'price-asc', 1, 24)
    where price_amount between 150000 and 350000
  ),
  'price and accepts-offers filters constrain eligible results'
);
select ok(
  (select count(*) from public.search_discovery_services_v3(null, null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 2)) = 2,
  'discovery pagination enforces the requested bounded page size'
);
select ok(
  exists (
    select 1
    from public.search_discovery_services_v3(null, null, null, null, null, null, null, null, null, null, null, 'recommended', 1, 2)
    where has_more
  )
  and not exists (
    select 1
    from public.search_discovery_services_v3(null, null, null, null, null, null, null, null, null, null, null, 'recommended', 3, 2)
    where has_more
  ),
  'v2 pagination exposes has_more without returning an extra row'
);

select * from finish();
rollback;
