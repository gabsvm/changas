begin;

select plan(13);

select ok(
  to_regprocedure('public.send_conversation_text(uuid,text,uuid)') is not null,
  'text send RPC exists'
);
select ok(
  to_regprocedure('public.list_conversation_messages(uuid,timestamp with time zone,uuid,integer)') is not null,
  'bounded message pagination RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.send_conversation_text(uuid,text,uuid)', 'EXECUTE'),
  'anonymous users cannot send messages'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000','04600000-0000-4000-8000-000000000001','authenticated','authenticated','phase04-msg-client@example.test','x',now(),now(),now(),'{}','{"display_name":"Msg Client"}'),
  ('00000000-0000-0000-0000-000000000000','04600000-0000-4000-8000-000000000002','authenticated','authenticated','phase04-msg-provider@example.test','x',now(),now(),now(),'{}','{"display_name":"Msg Provider"}'),
  ('00000000-0000-0000-0000-000000000000','04600000-0000-4000-8000-000000000003','authenticated','authenticated','phase04-msg-outsider@example.test','x',now(),now(),now(),'{}','{"display_name":"Msg Outsider"}');

insert into public.provider_profiles (user_id,status,onboarding_step,public_slug)
values ('04600000-0000-4000-8000-000000000002','ACTIVE',4,'phase04-msg-provider');
insert into public.categories (id,slug,name,description,sort_order)
values ('04610000-0000-4000-8000-000000000001','phase04-msg-category','Phase04 Msg Category','Synthetic message category.',992);
insert into public.skills (id,category_id,slug,name,description,sort_order)
values ('04620000-0000-4000-8000-000000000001','04610000-0000-4000-8000-000000000001','phase04-msg-skill','Phase04 Msg Skill','Synthetic message skill.',992);
insert into public.provider_skills (provider_user_id,skill_id)
values ('04600000-0000-4000-8000-000000000002','04620000-0000-4000-8000-000000000001');
insert into public.services (id,provider_user_id,skill_id,public_slug,title,description,modality,price_model,price_amount,currency_code,schedule_type,is_published)
values ('04630000-0000-4000-8000-000000000001','04600000-0000-4000-8000-000000000002','04620000-0000-4000-8000-000000000001','phase04-msg-service','Servicio Mensajes','Servicio sintético suficientemente descriptivo para probar mensajes seguros.','REMOTE','FIXED',150000,'ARS','UNSCHEDULED',true);
insert into public.conversations (id,service_id,client_user_id,provider_user_id)
values ('04640000-0000-4000-8000-000000000001','04630000-0000-4000-8000-000000000001','04600000-0000-4000-8000-000000000001','04600000-0000-4000-8000-000000000002');
insert into public.conversation_participants (conversation_id,user_id,role)
values
 ('04640000-0000-4000-8000-000000000001','04600000-0000-4000-8000-000000000001','CLIENT'),
 ('04640000-0000-4000-8000-000000000001','04600000-0000-4000-8000-000000000002','PROVIDER');

set local role authenticated;
select set_config('request.jwt.claim.sub','04600000-0000-4000-8000-000000000001',true);

select ok(
  public.send_conversation_text(
    '04640000-0000-4000-8000-000000000001',
    'Hola desde el cliente',
    '04650000-0000-4000-8000-000000000001'
  ) is not null,
  'participant can send text'
);
select is(
  public.send_conversation_text(
    '04640000-0000-4000-8000-000000000001',
    'Hola desde el cliente',
    '04650000-0000-4000-8000-000000000001'
  ),
  (select id from public.messages where client_nonce = '04650000-0000-4000-8000-000000000001'),
  'same nonce is idempotent'
);
select throws_ok(
  $$select public.send_conversation_text('04640000-0000-4000-8000-000000000001','   ','04650000-0000-4000-8000-000000000002')$$,
  '22023', null, 'empty text is rejected'
);
select throws_ok(
  $$select public.send_conversation_text('04640000-0000-4000-8000-000000000001',repeat('x',4001),'04650000-0000-4000-8000-000000000003')$$,
  '22023', null, 'overlong text is rejected'
);
select is(
  (select count(*)::integer from public.list_conversation_messages('04640000-0000-4000-8000-000000000001',null,null,50)),
  1,
  'participant can page conversation messages'
);
select throws_ok(
  $$select * from public.list_conversation_messages('04640000-0000-4000-8000-000000000001',null,null,51)$$,
  '22023', null, 'message page size above 50 is rejected'
);

select set_config('request.jwt.claim.sub','04600000-0000-4000-8000-000000000003',true);
select throws_ok(
  $$select public.send_conversation_text('04640000-0000-4000-8000-000000000001','Intrusión','04650000-0000-4000-8000-000000000004')$$,
  '42501', null, 'outsider cannot send text'
);

set local role postgres;
insert into public.user_blocks (conversation_id,blocker_user_id,blocked_user_id)
values ('04640000-0000-4000-8000-000000000001','04600000-0000-4000-8000-000000000002','04600000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','04600000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.send_conversation_text('04640000-0000-4000-8000-000000000001','No debería salir','04650000-0000-4000-8000-000000000005')$$,
  '42501', null, 'active block prevents new text'
);

select set_config('request.jwt.claim.sub','04600000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select * from public.list_conversation_messages('04640000-0000-4000-8000-000000000001',null,null,0)$$,
  '22023', null, 'page size below one is rejected'
);

select ok(
  (select last_message_at is not null from public.conversations where id = '04640000-0000-4000-8000-000000000001'),
  'successful send advances conversation last message time'
);

select * from finish();
rollback;
