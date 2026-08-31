-- Phase 02 synthetic demo data only. No identity documents, reviews, jobs,
-- payments, proposals, or other later-phase data are seeded.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo-provider@example.test',
  'not-a-real-password',
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Demo Proveedor"}'
)
on conflict (id) do nothing;

update public.profiles
set display_name = 'Demo Proveedor',
    public_zone = 'Palermo y alrededores',
    bio = 'Perfil sintético para validar la gestión de servicios y disponibilidad.'
where id = '23000000-0000-4000-8000-000000000001';

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '23000000-0000-4000-8000-000000000001',
  'ACTIVE',
  4,
  'demo-proveedor',
  'Soporte técnico y soluciones claras'
)
on conflict (user_id) do update set
  status = 'ACTIVE',
  onboarding_step = 4,
  public_slug = excluded.public_slug,
  public_headline = excluded.public_headline;

insert into public.provider_skills (provider_user_id, skill_id, is_featured, sort_order)
values
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', true, 10),
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000004', true, 20),
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000010', false, 30)
on conflict (provider_user_id, skill_id) do update set
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, price_unit, accepts_offers,
  expected_duration_minutes, schedule_type, includes, is_published, sort_order
) values
  ('24000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', 'demo-revision-pc', 'Revisión de PC a distancia', 'Diagnóstico inicial y recomendaciones claras para tu equipo.', 'REMOTE', 'FIXED', 1250000, 'ARS', null, false, 60, 'UNSCHEDULED', 'Informe sintético de diagnóstico', true, 10),
  ('24000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000004', 'demo-soporte-remoto', 'Soporte técnico remoto', 'Ayuda guiada para resolver problemas habituales de software.', 'BOTH', 'STARTING_AT', 900000, 'ARS', null, true, 45, 'FLEXIBLE_WINDOW', 'Sesión inicial de orientación', true, 20),
  ('24000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000010', 'demo-diseno-hora', 'Diseño gráfico por hora', 'Diseño de piezas visuales simples para proyectos y comercios.', 'REMOTE', 'HOURLY', 1500000, 'ARS', null, true, 120, 'DEADLINE', 'Una ronda de ajustes', true, 30),
  ('24000000-0000-4000-8000-000000000004', '23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', 'demo-limpieza-equipo', 'Limpieza de equipo por unidad', 'Limpieza preventiva de un equipo con recomendaciones básicas.', 'IN_PERSON', 'PER_UNIT', 1000000, 'ARS', 'equipo', false, 90, 'FIXED_SLOT', 'Limpieza exterior y revisión visual', true, 40),
  ('24000000-0000-4000-8000-000000000005', '23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000004', 'demo-proyecto-a-medida', 'Solución técnica a medida', 'Relevamiento y propuesta para necesidades técnicas particulares.', 'BOTH', 'QUOTE', null, 'ARS', null, true, null, 'UNSCHEDULED', 'Alcance acordado antes de comenzar', true, 50)
on conflict (id) do update set
  is_published = excluded.is_published,
  is_paused = false,
  accepts_offers = excluded.accepts_offers;

insert into public.service_tags (service_id, tag)
values
  ('24000000-0000-4000-8000-000000000001', 'diagnóstico'),
  ('24000000-0000-4000-8000-000000000002', 'ayuda remota'),
  ('24000000-0000-4000-8000-000000000003', 'piezas visuales')
on conflict (service_id, normalized_tag) do nothing;

insert into public.experiences (
  provider_user_id, title, organization, description, started_on, is_current, is_public, sort_order
) values (
  '23000000-0000-4000-8000-000000000001',
  'Soporte técnico independiente',
  'Changas Lab',
  'Acompañamiento sintético para equipos y proyectos digitales.',
  '2021-01-01',
  true,
  true,
  10
)
on conflict do nothing;

insert into public.education (
  provider_user_id, institution, field_of_study, description, started_on, is_public, sort_order
) values (
  '23000000-0000-4000-8000-000000000001',
  'Instituto Técnico Demo',
  'Informática aplicada',
  'Registro sintético para mostrar formación pública.',
  '2018-03-01',
  true,
  10
)
on conflict do nothing;

insert into public.certifications (
  provider_user_id, title, issuer, description, issued_on, is_public, sort_order
) values (
  '23000000-0000-4000-8000-000000000001',
  'Certificación técnica sintética',
  'Changas Test',
  'No representa una credencial real ni contiene evidencia privada.',
  '2024-05-01',
  true,
  10
)
on conflict do nothing;

insert into public.portfolio_items (
  provider_user_id, title, description, is_public, sort_order
) values
  ('23000000-0000-4000-8000-000000000001', 'Diagnóstico de muestra', 'Caso sintético sin datos personales.', true, 10),
  ('23000000-0000-4000-8000-000000000001', 'Borrador privado', 'Muestra no publicada para validar el estado privado.', false, 20)
on conflict do nothing;

insert into public.service_areas (provider_user_id, label, center, radius_meters)
values (
  '23000000-0000-4000-8000-000000000001',
  'Palermo y alrededores',
  extensions.st_setsrid(extensions.st_makepoint(-58.43, -34.58), 4326)::extensions.geography,
  5000
)
on conflict do nothing;

insert into public.availability_rules (
  provider_user_id, weekday, start_time, end_time, timezone, is_active
) values
  ('23000000-0000-4000-8000-000000000001', 1, '09:00', '18:00', 'America/Argentina/Buenos_Aires', true),
  ('23000000-0000-4000-8000-000000000001', 3, '09:00', '18:00', 'America/Argentina/Buenos_Aires', true)
on conflict do nothing;

insert into public.availability_blocks (provider_user_id, starts_at, ends_at, reason)
values (
  '23000000-0000-4000-8000-000000000001',
  '2026-09-01 18:00:00+00',
  '2026-09-01 20:00:00+00',
  'Bloque sintético de prueba'
)
on conflict do nothing;
