begin;

select plan(15);

select ok(
  to_regprocedure('public.block_user_for_conversation(uuid,uuid)') is not null,
  'block conversation user RPC exists'
);
select ok(
  to_regprocedure('public.unblock_user(uuid,uuid)') is not null,
  'unblock conversation user RPC exists'
);
select ok(
  to_regprocedure('public.report_conversation(uuid,text,text)') is not null,
  'report conversation RPC exists'
);
select ok(
  to_regprocedure('public.record_conversation_moderation_warning(uuid,text[])') is not null,
  'moderation warning RPC exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000','04800000-0000-4000-8000-000000000001','authenticated','authenticated','phase04-mod-client@example.test','x',now(),now(),now(),'{}','{"display_name":"Mod Client"}'),
  ('00000000-0000-0000-0000-000000000000','04800000-0000-4000-8000-000000000002','authenticated','authenticated','phase04-mod-provider@example.test','x',now(),now(),now(),'{}','{"display_name":"Mod Provider"}'),
  ('00000000-0000-0000-0000-000000000000','04800000-0000-4000-8000-000000000003','authenticated','authenticated','phase04-mod-outsider@example.test','x',now(),now(),now(),'{}','{"display_name":"Mod Outsider"}');

insert into public.provider_profiles (user_id,status,onboarding_step,public_slug)
values ('04800000-0000-4000-8000-000000000002','ACTIVE',4,'phase04-mod-provider');
insert into public.categories (id,slug,name,description,sort_order)
values ('04810000-0000-4000-8000-000000000001','phase04-mod-category','Phase04 Mod Category','Synthetic moderation category.',990);
insert into public.skills (id,category_id,slug,name,description,sort_order)
values ('04820000-0000-4000-8000-000000000001','04810000-0000-4000-8000-000000000001','phase04-mod-skill','Phase04 Mod Skill','Synthetic moderation skill.',990);
insert into public.provider_skills (provider_user_id,skill_id)
values ('04800000-0000-4000-8000-000000000002','04820000-0000-4000-8000-000000000001');
insert into public.services (id,provider_user_id,skill_id,public_slug,title,description,modality,price_model,price_amount,currency_code,schedule_type,is_published)
values ('04830000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000002','04820000-0000-4000-8000-000000000001','phase04-mod-service','Servicio Moderación','Servicio sintético suficientemente descriptivo para probar moderación segura.','REMOTE','FIXED',150000,'ARS','UNSCHEDULED',true);
insert into public.conversations (id,service_id,client_user_id,provider_user_id)
values ('04840000-0000-4000-8000-000000000001','04830000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000002');
insert into public.conversation_participants (conversation_id,user_id,role)
values
 ('04840000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000001','CLIENT'),
 ('04840000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000002','PROVIDER');
insert into public.messages (id,conversation_id,sender_user_id,kind,body,client_nonce)
values ('04850000-0000-4000-8000-000000000001','04840000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000001','TEXT','Mensaje histórico','04860000-0000-4000-8000-000000000001');

select ok(
  not has_function_privilege('anon', 'public.block_user_for_conversation(uuid,uuid)', 'EXECUTE'),
  'anonymous users cannot block'
);
select ok(
  not has_function_privilege('anon', 'public.report_conversation(uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot report'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','04800000-0000-4000-8000-000000000001',true);

select lives_ok(
  $$select public.block_user_for_conversation('04840000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000002')$$,
  'participant can block the other participant'
);
select is(
  (select count(*)::integer from public.user_blocks where conversation_id='04840000-0000-4000-8000-000000000001' and blocker_user_id='04800000-0000-4000-8000-000000000001' and blocked_user_id='04800000-0000-4000-8000-000000000002'),
  1,
  'block row is durable'
);
select is(
  (select count(*)::integer from public.messages where conversation_id='04840000-0000-4000-8000-000000000001'),
  1,
  'blocking preserves conversation history'
);
select throws_ok(
  $$select public.send_conversation_text('04840000-0000-4000-8000-000000000001','No debe salir','04860000-0000-4000-8000-000000000002')$$,
  '42501', null, 'active block prevents new informal text'
);
select lives_ok(
  $$select public.unblock_user('04840000-0000-4000-8000-000000000001','04800000-0000-4000-8000-000000000002')$$,
  'blocker can unblock peer'
);
select is(
  (select count(*)::integer from public.user_blocks where conversation_id='04840000-0000-4000-8000-000000000001' and blocker_user_id='04800000-0000-4000-8000-000000000001'),
  0,
  'unblock removes only caller block row'
);
select ok(
  public.report_conversation(
    '04840000-0000-4000-8000-000000000001',
    'SPAM',
    'Mensajes repetidos'
  ) is not null,
  'participant can report conversation'
);
select ok(
  public.record_conversation_moderation_warning(
    '04840000-0000-4000-8000-000000000001',
    array['EMAIL','PHONE']::text[]
  ) is not null,
  'participant can record warning signal types'
);
select is(
  (select metadata ? 'text' from public.conversation_moderation_events where conversation_id='04840000-0000-4000-8000-000000000001' order by created_at desc limit 1),
  false,
  'moderation warning metadata never stores message text'
);

select set_config('request.jwt.claim.sub','04800000-0000-4000-8000-000000000003',true);
select throws_ok(
  $$select public.report_conversation('04840000-0000-4000-8000-000000000001','OTHER','Intrusión')$$,
  '42501', null, 'outsider cannot report conversation'
);

select * from finish();
rollback;
