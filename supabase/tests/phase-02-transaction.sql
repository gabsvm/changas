begin;

select plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '04000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'phase02-transaction@example.test',
  'not-a-real-password', now(), now(), now(), '{}', '{}'
);

insert into public.provider_profiles (user_id, public_slug, public_headline)
values ('04000000-0000-4000-8000-000000000001', 'transaction-provider', 'Transactional provider');

insert into public.provider_skills (provider_user_id, skill_id)
select '04000000-0000-4000-8000-000000000001', id
from public.skills where slug = 'reparacion-pc';

insert into public.services (
  provider_user_id, skill_id, public_slug, title, description, modality,
  price_model, price_amount, currency_code, schedule_type, is_published
)
select
  '04000000-0000-4000-8000-000000000001', id, 'atomic-service',
  'Título original',
  'Descripción sintética suficientemente larga para validar la transacción.',
  'REMOTE', 'FIXED', 100000, 'ARS', 'UNSCHEDULED', false
from public.skills where slug = 'reparacion-pc';

insert into public.service_tags (service_id, tag)
select id, 'original'
from public.services
where provider_user_id = '04000000-0000-4000-8000-000000000001'
  and public_slug = 'atomic-service';

set local role authenticated;
select set_config('request.jwt.claim.sub', '04000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.save_service_with_tags(
    (select id from public.services where provider_user_id = '04000000-0000-4000-8000-000000000001' and public_slug = 'atomic-service'),
    (select id from public.skills where slug = 'reparacion-pc'),
    'Título que debe hacer rollback',
    'Descripción actualizada que no debe persistir si falla el reemplazo de tags.',
    'REMOTE', 'FIXED', 200000, 'ARS', null, false, 60, 'UNSCHEDULED',
    null, null, null, false, false,
    array['uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve']
  )$$,
  '22023', null,
  'invalid tags fail after the service mutation inside the transaction'
);

select is(
  (select title from public.services where provider_user_id = '04000000-0000-4000-8000-000000000001' and public_slug = 'atomic-service'),
  'Título original',
  'service title rolls back when tag replacement fails'
);

select is(
  (select price_amount from public.services where provider_user_id = '04000000-0000-4000-8000-000000000001' and public_slug = 'atomic-service'),
  100000::bigint,
  'service price rolls back when tag replacement fails'
);

select results_eq(
  $$select tag from public.service_tags where service_id = (select id from public.services where provider_user_id = '04000000-0000-4000-8000-000000000001' and public_slug = 'atomic-service') order by tag$$,
  array['original'],
  'existing tags also remain unchanged after rollback'
);

select * from finish();
rollback;
