begin;

select plan(11);

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

set local role postgres;

-- Simulate an admin rejection for the owner (complete case already exists).
update public.provider_profiles
set status = 'REJECTED'
where user_id = '00000000-0000-0000-0000-000000001001';

insert into public.provider_identity_reviews (
  provider_user_id, reviewer_user_id, decision, previous_status, new_status, reason
) values (
  '00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001002',
  'REJECT',
  'IDENTITY_PENDING',
  'REJECTED',
  'DNI ilegible, reintentar.'
);

-- A second rejected provider without documents (RLS behavior only).
update public.provider_profiles
set status = 'REJECTED'
where user_id = '00000000-0000-0000-0000-000000001002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $
    select public.submit_provider_identity_review()
  $,
  'rejected owner can resubmit a complete case for review'
);

select is(
  (select status::text from public.provider_profiles
   where user_id = '00000000-0000-0000-0000-000000001001'),
  'IDENTITY_PENDING',
  'resubmit from REJECTED persists IDENTITY_PENDING'
);

select is(
  (select reason from public.get_my_latest_identity_review()),
  'DNI ilegible, reintentar.',
  'owner can read their own rejection reason'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001002', true);

select is(
  (select count(*) from public.get_my_latest_identity_review()),
  0::bigint,
  'provider cannot read another provider review'
);

select lives_ok(
  $
    update public.provider_profiles
    set onboarding_step = 2
    where user_id = '00000000-0000-0000-0000-000000001002'
  $,
  'rejected owner can save onboarding progress'
);

select throws_ok(
  $
    update public.provider_profiles
    set status = 'PROFILE_INCOMPLETE'
    where user_id = '00000000-0000-0000-0000-000000001002'
  $,
  '42501',
  null,
  'rejected owner still cannot flip status directly'
);

select * from finish();
rollback;
