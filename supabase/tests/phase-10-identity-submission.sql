begin;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000001001',
    'authenticated', 'authenticated', 'phase10-identity-owner@example.com', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase 10 Owner"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000001002',
    'authenticated', 'authenticated', 'phase10-identity-other@example.com', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase 10 Other"}'
  );

insert into public.provider_profiles (user_id, status, onboarding_step)
values
  ('00000000-0000-0000-0000-000000001001', 'PROFILE_INCOMPLETE', 4),
  ('00000000-0000-0000-0000-000000001002', 'PROFILE_INCOMPLETE', 4);

insert into public.profiles (id, display_name, public_zone, bio)
values (
  '00000000-0000-0000-0000-000000001001',
  'Phase 10 Owner',
  'Zona de prueba',
  'Perfil sintético completo.'
)
on conflict (id) do update
set display_name = excluded.display_name,
    public_zone = excluded.public_zone,
    bio = excluded.bio;

insert into public.profile_private (
  user_id, legal_name, private_phone, date_of_birth, exact_address, dni_number
) values (
  '00000000-0000-0000-0000-000000001001',
  'Persona de prueba',
  '0000000000',
  '1990-01-01',
  'Domicilio sintético',
  '00000000'
)
on conflict (user_id) do update
set legal_name = excluded.legal_name,
    private_phone = excluded.private_phone,
    date_of_birth = excluded.date_of_birth,
    exact_address = excluded.exact_address,
    dni_number = excluded.dni_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    update public.provider_profiles
    set status = 'IDENTITY_PENDING'
    where user_id = '00000000-0000-0000-0000-000000001001'
  $$,
  '42501',
  null,
  'identity submission is rejected until private evidence exists'
);

set local role postgres;

insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'identity-documents',
  '00000000-0000-0000-0000-000000001001/phase10-front.jpg',
  '00000000-0000-0000-0000-000000001001',
  '{"mimetype":"image/jpeg","size":4}'::jsonb
), (
  'identity-documents',
  '00000000-0000-0000-0000-000000001001/phase10-back.jpg',
  '00000000-0000-0000-0000-000000001001',
  '{"mimetype":"image/jpeg","size":4}'::jsonb
), (
  'identity-documents',
  '00000000-0000-0000-0000-000000001001/phase10-selfie.jpg',
  '00000000-0000-0000-0000-000000001001',
  '{"mimetype":"image/jpeg","size":4}'::jsonb
);

insert into public.provider_documents (
  user_id, document_type, storage_path, mime_type, file_size_bytes
) values (
  '00000000-0000-0000-0000-000000001001',
  'DNI_FRONT',
  '00000000-0000-0000-0000-000000001001/phase10-front.jpg',
  'image/jpeg',
  4
), (
  '00000000-0000-0000-0000-000000001001',
  'DNI_BACK',
  '00000000-0000-0000-0000-000000001001/phase10-back.jpg',
  'image/jpeg',
  4
), (
  '00000000-0000-0000-0000-000000001001',
  'SELFIE',
  '00000000-0000-0000-0000-000000001001/phase10-selfie.jpg',
  'image/jpeg',
  4
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.submit_provider_identity_review()
  $$,
  'owner can submit a complete evidence-backed profile for identity review'
);

select is(
  (select status::text from public.provider_profiles
   where user_id = '00000000-0000-0000-0000-000000001001'),
  'IDENTITY_PENDING',
  'successful self-submission persists IDENTITY_PENDING'
);

select throws_ok(
  $$
    update public.provider_profiles
    set status = 'ACTIVE'
    where user_id = '00000000-0000-0000-0000-000000001001'
  $$,
  '42501',
  null,
  'owner still cannot self-promote identity review to ACTIVE'
);

update public.provider_profiles
set status = 'IDENTITY_PENDING'
where user_id = '00000000-0000-0000-0000-000000001002';

set local role postgres;
select is(
  (select status::text from public.provider_profiles
   where user_id = '00000000-0000-0000-0000-000000001002'),
  'PROFILE_INCOMPLETE',
  'owner cannot transition another provider through RLS'
);

select * from finish();
rollback;
