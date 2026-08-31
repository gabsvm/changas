begin;

select plan(23);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.certifications'::regclass
      and conname = 'certifications_evidence_path_owner_check'
      and pg_get_constraintdef(oid) like '%split_part%provider_user_id%'
  ),
  'certification evidence paths are constrained to the row owner folder'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.portfolio_items'::regclass
      and conname = 'portfolio_media_path_owner_check'
      and pg_get_constraintdef(oid) like '%split_part%provider_user_id%'
  ),
  'portfolio media paths are constrained to the row owner folder'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_provider_skill_fk'
      and contype = 'f'
      and confrelid = 'public.provider_skills'::regclass
  ),
  'services require a skill selected by the same provider'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_price_amount_minor_units_check'
      and pg_get_constraintdef(oid) like '%9007199254740991%'
  ),
  'service prices have a positive safe minor-unit bound'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_currency_ars_check'
  ),
  'Phase 02 currency is restricted to ARS'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_provider_profiles'
      and column_name = 'verification_badge'
  ),
  'public provider projection has no fake verification claim'
);
select ok(
  (select array_agg(column_name::text order by ordinal_position)
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'public_service_tags') =
  array['provider_slug', 'service_public_slug', 'tag']::text[],
  'public service tags preserve provider and service composite identity'
);
select ok(
  pg_get_functiondef('public.is_public_portfolio_media(text)'::regprocedure) like '%split_part%provider_user_id%',
  'public portfolio media validation checks the owner folder'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '03000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase02-audit-a@example.com', 'not-a-real-password', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '03000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase02-audit-b@example.com', 'not-a-real-password', now(), now(), now(), '{}', '{}');

insert into public.provider_profiles (user_id, public_slug, public_headline)
values
  ('03000000-0000-4000-8000-000000000001', 'audit-a', 'Proveedor A'),
  ('03000000-0000-4000-8000-000000000002', 'audit-b', 'Proveedor B');

insert into public.provider_skills (provider_user_id, skill_id)
values
  ('03000000-0000-4000-8000-000000000001', (select id from public.skills where slug = 'reparacion-pc')),
  ('03000000-0000-4000-8000-000000000002', (select id from public.skills where slug = 'soporte-tecnico-remoto'));

set local role authenticated;
select set_config('request.jwt.claim.sub', '03000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.services (
  provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, schedule_type, is_published
) values (
  '03000000-0000-4000-8000-000000000001',
  (select id from public.skills where slug = 'reparacion-pc'),
  'soporte-pc', 'Soporte PC del proveedor A',
  'Diagnóstico sintético para verificar el aislamiento por proveedor.',
  'REMOTE', 'FIXED', 1250000, 'ARS', 'UNSCHEDULED', false
);

select ok(
  exists (select 1 from public.services where provider_user_id = '03000000-0000-4000-8000-000000000001' and public_slug = 'soporte-pc' and price_amount = 1250000),
  'provider can create a service using a selected skill and minor units'
);
select throws_ok(
  $$insert into public.services (provider_user_id, skill_id, public_slug, title, description, modality, price_model, price_amount, currency_code, schedule_type)
    values ('03000000-0000-4000-8000-000000000001', (select id from public.skills where slug = 'soporte-tecnico-remoto'), 'unselected-skill', 'Skill no seleccionada', 'Este servicio debe fallar por integridad de provider skill.', 'REMOTE', 'FIXED', 100000, 'ARS', 'UNSCHEDULED')$$,
  '23503', null, 'provider cannot create a service with another provider skill'
);
select throws_ok(
  $$delete from public.provider_skills where provider_user_id = '03000000-0000-4000-8000-000000000001' and skill_id = (select id from public.skills where slug = 'reparacion-pc')$$,
  '23503', null, 'provider cannot remove a skill with dependent services'
);

update public.services
set title = 'Soporte PC A actualizado'
where provider_user_id = '03000000-0000-4000-8000-000000000001'
  and public_slug = 'soporte-pc';
select ok(
  (select title = 'Soporte PC A actualizado' from public.services where provider_user_id = '03000000-0000-4000-8000-000000000001' and public_slug = 'soporte-pc'),
  'owner can update their service row'
);

set local role postgres;
select private.activate_provider_for_test('03000000-0000-4000-8000-000000000001');
select private.activate_provider_for_test('03000000-0000-4000-8000-000000000002');
update public.services
set is_published = true
where provider_user_id = '03000000-0000-4000-8000-000000000001'
  and public_slug = 'soporte-pc';
insert into public.services (
  provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, schedule_type, is_published
) values (
  '03000000-0000-4000-8000-000000000002',
  (select id from public.skills where slug = 'soporte-tecnico-remoto'),
  'soporte-pc', 'Soporte PC del proveedor B',
  'Servicio sintético distinto para verificar el tenant de los tags.',
  'REMOTE', 'FIXED', 100000, 'ARS', 'UNSCHEDULED', true
);
insert into public.service_tags (service_id, tag)
select id, 'hardware'
from public.services
where provider_user_id = '03000000-0000-4000-8000-000000000001' and public_slug = 'soporte-pc';
insert into public.service_tags (service_id, tag)
select id, 'software'
from public.services
where provider_user_id = '03000000-0000-4000-8000-000000000002' and public_slug = 'soporte-pc';

set local role anon;
select results_eq(
  $$select tag from public.public_service_tags where provider_slug = 'audit-a' and service_public_slug = 'soporte-pc'$$,
  array['hardware'],
  'public tags for provider A do not include provider B tags'
);
select results_eq(
  $$select tag from public.public_service_tags where provider_slug = 'audit-b' and service_public_slug = 'soporte-pc'$$,
  array['software'],
  'public tags for provider B do not include provider A tags'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '03000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update public.services
set title = 'B intenta modificar A'
where provider_user_id = '03000000-0000-4000-8000-000000000001'
  and public_slug = 'soporte-pc';
set local role postgres;
select is(
  (select title from public.services where provider_user_id = '03000000-0000-4000-8000-000000000001' and public_slug = 'soporte-pc'),
  'Soporte PC A actualizado',
  'provider B cannot modify provider A service'
);
set local role authenticated;
select is(
  (select count(*)::integer from public.services where provider_user_id = '03000000-0000-4000-8000-000000000001'),
  0,
  'provider B cannot read provider A service rows'
);

select throws_ok(
  $$insert into public.certifications (provider_user_id, title, evidence_path, evidence_mime_type, evidence_file_size_bytes)
    values ('03000000-0000-4000-8000-000000000001', 'Proveedor ajeno', '03000000-0000-4000-8000-000000000001/evidence.pdf', 'application/pdf', 12)$$,
  '42501', null, 'provider B cannot insert provider A certification through RLS'
);

select set_config('request.jwt.claim.sub', '03000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.certifications (provider_user_id, title, evidence_path, evidence_mime_type, evidence_file_size_bytes)
    values ('03000000-0000-4000-8000-000000000001', 'Ruta forjada', '03000000-0000-4000-8000-000000000002/evidence.pdf', 'application/pdf', 12)$$,
  '23514', null, 'owner cannot point certification metadata to another folder'
);
select throws_ok(
  $$insert into public.portfolio_items (provider_user_id, title, media_path, media_mime_type, media_file_size_bytes, is_public)
    values ('03000000-0000-4000-8000-000000000001', 'Media forjada', '03000000-0000-4000-8000-000000000002/media.png', 'image/png', 12, true)$$,
  '23514', null, 'owner cannot point public portfolio metadata to another folder'
);
insert into public.portfolio_items (provider_user_id, title, media_path, media_mime_type, media_file_size_bytes, is_public)
values ('03000000-0000-4000-8000-000000000001', 'Media pública', '03000000-0000-4000-8000-000000000001/public.png', 'image/png', 12, true);
insert into public.portfolio_items (provider_user_id, title, is_public)
values ('03000000-0000-4000-8000-000000000001', 'Media privada', false);

set local role anon;
select is(
  (select count(*)::integer from public.public_provider_portfolio where provider_slug = 'audit-a' and media_path like '%private.png'),
  0,
  'owner private privileges do not make unregistered public media visible'
);
select ok(
  public.is_public_portfolio_media('03000000-0000-4000-8000-000000000001/public.png'),
  'active public portfolio metadata is accepted by the Storage authorization function'
);
select ok(
  not public.is_public_portfolio_media('03000000-0000-4000-8000-000000000001/private.png'),
  'private portfolio metadata is rejected by the Storage authorization function'
);
select ok(
  not public.is_public_portfolio_media('03000000-0000-4000-8000-000000000002/forged.png'),
  'a forged foreign-folder path is rejected by the Storage authorization function'
);

set local role postgres;
delete from public.services
where provider_user_id = '03000000-0000-4000-8000-000000000001' and public_slug = 'soporte-pc';
delete from public.provider_skills
where provider_user_id = '03000000-0000-4000-8000-000000000001'
  and skill_id = (select id from public.skills where slug = 'reparacion-pc');
select is(
  (select count(*)::integer from public.provider_skills where provider_user_id = '03000000-0000-4000-8000-000000000001' and skill_id = (select id from public.skills where slug = 'reparacion-pc')),
  0,
  'provider can remove a skill after dependent services are gone'
);

select * from finish();
rollback;
