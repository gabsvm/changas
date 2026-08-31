begin;

select plan(10);

select ok(
  to_regprocedure('public.mark_conversation_read(uuid,uuid)') is not null,
  'mark conversation read RPC exists'
);
select ok(
  to_regprocedure('public.append_conversation_system_event(uuid,text,uuid)') is not null,
  'internal system event RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.mark_conversation_read(uuid,uuid)', 'EXECUTE'),
  'anonymous users cannot mark conversations read'
);
select ok(
  not has_function_privilege('authenticated', 'public.append_conversation_system_event(uuid,text,uuid)', 'EXECUTE'),
  'authenticated clients cannot manufacture system events'
);
select ok(
  has_function_privilege('service_role', 'public.append_conversation_system_event(uuid,text,uuid)', 'EXECUTE'),
  'service role can append internal system events'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000','04700000-0000-4000-8000-000000000001','authenticated','authenticated','phase04-read-client@example.test','x',now(),now(),now(),'{}','{"display_name":"Read Client"}'),
  ('00000000-0000-0000-0000-000000000000','04700000-0000-4000-8000-000000000002','authenticated','authenticated','phase04-read-provider@example.test','x',now(),now(),now(),'{}','{"display_name":"Read Provider"}'),
  ('00000000-0000-0000-0000-000000000000','04700000-0000-4000-8000-000000000003','authenticated','authenticated','phase04-read-outsider@example.test','x',now(),now(),now(),'{}','{"display_name":"Read Outsider"}');

insert into public.provider_profiles (user_id,status,onboarding_step,public_slug)
values ('04700000-0000-4000-8000-000000000002','ACTIVE',4,'phase04-read-provider');
insert into public.categories (id,slug,name,description,sort_order)
values ('04710000-0000-4000-8000-000000000001','phase04-read-category','Phase04 Read Category','Synthetic read category.',991);
insert into public.skills (id,category_id,slug,name,description,sort_order)
values ('04720000-0000-4000-8000-000000000001','04710000-0000-4000-8000-000000000001','phase04-read-skill','Phase04 Read Skill','Synthetic read skill.',991);
insert into public.provider_skills (provider_user_id,skill_id)
values ('04700000-0000-4000-8000-000000000002','04720000-0000-4000-8000-000000000001');
insert into public.services (id,provider_user_id,skill_id,public_slug,title,description,modality,price_model,price_amount,currency_code,schedule_type,is_published)
values ('04730000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000002','04720000-0000-4000-8000-000000000001','phase04-read-service','Servicio Read','Servicio sintético suficientemente descriptivo para probar read cursors.','REMOTE','FIXED',150000,'ARS','UNSCHEDULED',true);
insert into public.conversations (id,service_id,client_user_id,provider_user_id)
values ('04740000-0000-4000-8000-000000000001','04730000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000002');
insert into public.conversation_participants (conversation_id,user_id,role)
values
 ('04740000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000001','CLIENT'),
 ('04740000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000002','PROVIDER');
insert into public.messages (id,conversation_id,sender_user_id,kind,body,client_nonce,created_at)
values
 ('04750000-0000-4000-8000-000000000001','04740000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000002','TEXT','Primero','04760000-0000-4000-8000-000000000001','2026-08-31 10:00:00+00'),
 ('04750000-0000-4000-8000-000000000002','04740000-0000-4000-8000-000000000001','04700000-0000-4000-8000-000000000002','TEXT','Segundo','04760000-0000-4000-8000-000000000002','2026-08-31 10:01:00+00');

set local role authenticated;
select set_config('request.jwt.claim.sub','04700000-0000-4000-8000-000000000001',true);

select lives_ok(
  $$select public.mark_conversation_read('04740000-0000-4000-8000-000000000001','04750000-0000-4000-8000-000000000001')$$,
  'participant can advance own read cursor'
);
select is(
  (select last_read_message_id from public.conversation_reads where conversation_id='04740000-0000-4000-8000-000000000001' and user_id='04700000-0000-4000-8000-000000000001'),
  '04750000-0000-4000-8000-000000000001'::uuid,
  'read cursor is stored for the caller only'
);
select is(
  (select count(*)::integer from public.conversation_reads where conversation_id='04740000-0000-4000-8000-000000000001' and user_id='04700000-0000-4000-8000-000000000002'),
  0,
  'marking read never mutates the other participant cursor'
);

select set_config('request.jwt.claim.sub','04700000-0000-4000-8000-000000000003',true);
select throws_ok(
  $$select public.mark_conversation_read('04740000-0000-4000-8000-000000000001','04750000-0000-4000-8000-000000000002')$$,
  '42501', null, 'outsider cannot mark a conversation read'
);

set local role service_role;
select ok(
  public.append_conversation_system_event(
    '04740000-0000-4000-8000-000000000001',
    'Evento interno',
    '04760000-0000-4000-8000-000000000003'
  ) is not null,
  'service role can append immutable system event'
);

select * from finish();
rollback;
