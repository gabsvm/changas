begin;

select plan(30);

select ok(
  (select count(*) = 1 from pg_constraint where conrelid = 'public.services'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%price_model%'),
  'services enforce a price-model amount invariant'
);
select ok(
  (select count(*) = 1 from pg_constraint where conrelid = 'public.services'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%price_unit%'),
  'services enforce a per-unit label invariant'
);
select ok(
  (select count(*) = 1
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'services'
     and column_name = 'modality'
     and udt_name = 'service_modality'),
  'services constrain modality through the database enum'
);
select ok(
  (select count(*) = 1 from pg_indexes where schemaname = 'public' and indexname = 'service_areas_center_gist_idx'),
  'service areas have a PostGIS GiST index for future radius queries'
);
select ok(
  (select count(*) = 1 from pg_trigger where tgrelid = 'public.provider_profiles'::regclass and tgname = 'provider_profiles_status_guard'),
  'provider status changes have a database guard'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '02000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase02-a@example.com', 'not-a-real-password', now(), now(), now(), '{}', '{"display_name":"Ana Técnica"}'),
  ('00000000-0000-0000-0000-000000000000', '02000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase02-b@example.com', 'not-a-real-password', now(), now(), now(), '{}', '{"display_name":"Bruno Diseño"}');

insert into public.provider_profiles (user_id, public_slug, public_headline)
values
  ('02000000-0000-4000-8000-000000000001', 'fase-02-ana', 'Tecnología clara para hogares y equipos'),
  ('02000000-0000-4000-8000-000000000002', 'fase-02-bruno', 'Diseño y soporte para proyectos reales');

insert into public.provider_skills (provider_user_id, skill_id)
select '02000000-0000-4000-8000-000000000001', id
from public.skills
where slug in ('reparacion-pc', 'ingles-conversacional');

select ok(
  (select count(*) = 2 from public.provider_skills where provider_user_id = '02000000-0000-4000-8000-000000000001'),
  'provider can own two unrelated catalog skills'
);
select ok(
  (select count(*) = 1 from information_schema.tables where table_schema = 'public' and table_name = 'services')
    and (select count(*) = 1 from information_schema.tables where table_schema = 'public' and table_name = 'skills'),
  'skills and services are separate relational concepts'
);

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, price_unit, accepts_offers,
  expected_duration_minutes, schedule_type, is_published
)
select
  ('02000000-0000-4000-8000-0000000000' || right('0' || row_number() over (order by s.price_model, s.modality)::text, 2))::uuid,
  '02000000-0000-4000-8000-000000000001',
  (select id from public.skills where slug = 'reparacion-pc'),
  'fase-02-' || lower(s.price_model) || '-' || replace(lower(s.modality), '_', '-'),
  'Servicio de prueba de Phase 02 ' || s.price_model || ' ' || s.modality,
  'Revisión y ejecución con alcance documentado para validar el catálogo.',
  s.modality::public.service_modality,
  s.price_model::public.price_model,
  case when s.price_model = 'QUOTE' then null else 12500 end,
  'ARS',
  case when s.price_model = 'PER_UNIT' then 'equipo' else null end,
  s.price_model in ('STARTING_AT', 'QUOTE'),
  60,
  'UNSCHEDULED',
  false
from (values
  ('FIXED', 'REMOTE'),
  ('STARTING_AT', 'IN_PERSON'),
  ('HOURLY', 'BOTH'),
  ('PER_UNIT', 'IN_PERSON'),
  ('QUOTE', 'REMOTE')
) as s(price_model, modality);

select ok(
  (select count(*) = 5 from public.services where provider_user_id = '02000000-0000-4000-8000-000000000001'),
  'all five price models persist for one provider'
);
select ok(
  (select count(distinct modality) = 3 from public.services where provider_user_id = '02000000-0000-4000-8000-000000000001'),
  'all three service modalities persist'
);
select throws_ok(
  $$insert into public.services (provider_user_id, skill_id, public_slug, title, description, modality, price_model, price_amount, schedule_type)
    values ('02000000-0000-4000-8000-000000000001', (select id from public.skills limit 1), 'invalid-quote', 'Quote inválido', 'Este servicio no puede tener precio fijo.', 'REMOTE', 'QUOTE', 1000, 'UNSCHEDULED')$$,
  '23514', null, 'quote service cannot persist a price amount'
);
select throws_ok(
  $$insert into public.services (provider_user_id, skill_id, public_slug, title, description, modality, price_model, price_amount, schedule_type)
    values ('02000000-0000-4000-8000-000000000001', (select id from public.skills limit 1), 'invalid-unit', 'Unidad inválida', 'Este servicio necesita indicar su unidad.', 'REMOTE', 'PER_UNIT', 1000, 'UNSCHEDULED')$$,
  '23514', null, 'per-unit service cannot omit its unit'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-4000-8000-000000000001', true);

insert into public.service_tags (service_id, tag)
select id, 'soporte remoto'
from public.services
where public_slug = 'fase-02-hourly-both';

insert into public.experiences (provider_user_id, title, organization, started_on, is_current, is_public)
values ('02000000-0000-4000-8000-000000000001', 'Técnica independiente', 'Changas Lab', '2020-01-01', true, true);
insert into public.experiences (provider_user_id, title, organization, started_on, ended_on, is_current, is_public)
values ('02000000-0000-4000-8000-000000000001', 'Experiencia privada', 'Archivo privado', '2019-01-01', '2019-12-01', false, false);
insert into public.education (provider_user_id, institution, field_of_study, started_on, is_public)
values ('02000000-0000-4000-8000-000000000001', 'Instituto Técnico', 'Informática', '2018-01-01', true);
insert into public.certifications (provider_user_id, title, issuer, issued_on, is_public, evidence_path)
values ('02000000-0000-4000-8000-000000000001', 'Certificación sintética', 'Changas Test', '2024-01-01', true, '02000000-0000-4000-8000-000000000001/evidence.pdf');
insert into public.portfolio_items (provider_user_id, title, description, is_public)
values ('02000000-0000-4000-8000-000000000001', 'Proyecto público', 'Una muestra sin datos personales.', true);
insert into public.portfolio_items (provider_user_id, title, description, is_public)
values ('02000000-0000-4000-8000-000000000001', 'Borrador privado', 'No debe aparecer al público.', false);
insert into public.service_areas (provider_user_id, label, center, radius_meters)
values (
  '02000000-0000-4000-8000-000000000001',
  'Palermo y alrededores',
  extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.58), 4326)::extensions.geography,
  5000
);
insert into public.availability_rules (provider_user_id, weekday, start_time, end_time, timezone)
values ('02000000-0000-4000-8000-000000000001', 1, '09:00', '18:00', 'America/Argentina/Buenos_Aires');
insert into public.availability_blocks (provider_user_id, starts_at, ends_at, reason)
values ('02000000-0000-4000-8000-000000000001', '2026-09-01 18:00:00+00', '2026-09-01 20:00:00+00', 'Turno personal');

select ok(
  (select count(*) = 1 from public.service_tags st join public.services s on s.id = st.service_id where s.provider_user_id = '02000000-0000-4000-8000-000000000001'),
  'provider can attach tags to their service'
);
select ok(
  (select count(*) = 1 from public.experiences where provider_user_id = '02000000-0000-4000-8000-000000000001' and is_public)
    and (select count(*) = 1 from public.education where provider_user_id = '02000000-0000-4000-8000-000000000001' and is_public),
  'provider can persist public professional records'
);
select ok(
  (select count(*) = 1 from public.service_areas where provider_user_id = '02000000-0000-4000-8000-000000000001')
    and (select count(*) = 1 from public.availability_rules where provider_user_id = '02000000-0000-4000-8000-000000000001')
    and (select count(*) = 1 from public.availability_blocks where provider_user_id = '02000000-0000-4000-8000-000000000001'),
  'provider can persist service areas and availability data'
);

update public.services
set is_paused = true
where public_slug = 'fase-02-fixed-remote';
select ok(
  (select is_paused from public.services where public_slug = 'fase-02-fixed-remote')
    and (select count(*) = 1 from public.services where public_slug = 'fase-02-fixed-remote'),
  'provider can pause a service without deleting it'
);

update public.provider_profiles
set availability_paused = true
where user_id = '02000000-0000-4000-8000-000000000001';
select ok(
  (select availability_paused from public.provider_profiles where user_id = '02000000-0000-4000-8000-000000000001'),
  'provider can pause availability without deleting rules'
);

set local role postgres;
select private.activate_provider_for_test('02000000-0000-4000-8000-000000000001');
select ok(
  (select status = 'ACTIVE' from public.provider_profiles where user_id = '02000000-0000-4000-8000-000000000001'),
  'controlled test path can activate a provider'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-4000-8000-000000000001', true);

update public.services
set is_published = true,
    is_paused = false
where public_slug = 'fase-02-fixed-remote';
update public.provider_profiles
set availability_paused = false
where user_id = '02000000-0000-4000-8000-000000000001';

set local role anon;
select results_eq(
  $$select public_slug from public.public_provider_profiles where public_slug = 'fase-02-ana'$$,
  array['fase-02-ana'],
  'anonymous visitor can see an active unpaused provider projection'
);
select results_eq(
  $$select public_slug from public.public_provider_services where public_slug = 'fase-02-fixed-remote'$$,
  array['fase-02-fixed-remote'],
  'anonymous visitor can see a published service projection'
);
select is(
  (select count(*)::integer from public.public_provider_services where public_slug = 'fase-02-hourly-both'),
  0,
  'anonymous visitor cannot see an unpublished service'
);
select is(
  (select count(*)::integer from public.public_provider_experiences where provider_slug = 'fase-02-ana'),
  1,
  'anonymous visitor sees only public experience rows'
);
select is(
  (select count(*)::integer from public.public_provider_portfolio where provider_slug = 'fase-02-ana'),
  1,
  'anonymous visitor sees only public portfolio rows'
);
select is(
  (select count(*)::integer from public.public_provider_service_areas where provider_slug = 'fase-02-ana'),
  1,
  'anonymous visitor sees approximate service area only'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_provider_service_areas'
      and column_name in ('center', 'latitude', 'longitude')
  ),
  'anonymous service-area projection contains no exact coordinates'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-4000-8000-000000000002', true);
update public.services
set title = 'B intenta cambiar A'
where public_slug = 'fase-02-fixed-remote';
set local role postgres;
select is(
  (select count(*)::integer from public.services where public_slug = 'fase-02-fixed-remote' and title = 'B intenta cambiar A'),
  0,
  'provider B cannot modify provider A service'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$insert into public.certifications (provider_user_id, title, is_public) values ('02000000-0000-4000-8000-000000000001', 'B intenta', false)$$,
  '42501', null, 'provider B cannot insert provider A certification'
);
select throws_ok(
  $$update public.provider_profiles set status = 'ACTIVE' where user_id = '02000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'provider cannot self-promote to ACTIVE'
);

select is(
  (select count(*)::integer from public.services where provider_user_id = '02000000-0000-4000-8000-000000000001'),
  0,
  'provider B cannot read provider A services through owner RLS'
);

update public.provider_profiles
set marketplace_paused = true
where user_id = '02000000-0000-4000-8000-000000000001';
set local role postgres;
select is(
  (select marketplace_paused from public.provider_profiles where user_id = '02000000-0000-4000-8000-000000000001'),
  false,
  'provider B cannot update provider A profile through owner RLS'
);

set local role postgres;
update public.provider_profiles
set marketplace_paused = true
where user_id = '02000000-0000-4000-8000-000000000001';
set local role anon;
select is(
  (select count(*)::integer from public.public_provider_profiles where public_slug = 'fase-02-ana'),
  0,
  'paused provider is removed from the public projection'
);

select * from finish();
rollback;
