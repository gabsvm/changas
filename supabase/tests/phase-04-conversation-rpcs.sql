begin;

select plan(12);

select ok(
  to_regprocedure('public.start_service_conversation(text,text)') is not null,
  'contextual conversation start RPC exists'
);
select ok(
  to_regprocedure('public.list_my_conversations(integer,timestamp with time zone,uuid)') is not null,
  'bounded conversation inbox RPC exists'
);
select ok(
  to_regprocedure('public.get_conversation_context(uuid)') is not null,
  'participant conversation context RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.start_service_conversation(text,text)', 'EXECUTE'),
  'anonymous users cannot start conversations'
);
select ok(
  has_function_privilege('authenticated', 'public.start_service_conversation(text,text)', 'EXECUTE'),
  'authenticated users can invoke contextual conversation start'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '04500000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'phase04-rpc-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"RPC Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '04500000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'phase04-rpc-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"RPC Provider"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '04500000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'phase04-rpc-outsider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"RPC Outsider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '04500000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  'phase04-rpc-provider',
  'Proveedor RPC sintético'
);

insert into public.categories (id, slug, name, description, sort_order)
values (
  '04510000-0000-4000-8000-000000000001',
  'phase04-rpc-category',
  'Phase04 RPC Category',
  'Categoría sintética para contratos RPC de conversaciones.',
  991
);

insert into public.skills (id, category_id, slug, name, description, sort_order)
values (
  '04520000-0000-4000-8000-000000000001',
  '04510000-0000-4000-8000-000000000001',
  'phase04-rpc-skill',
  'Phase04 RPC Skill',
  'Habilidad sintética para contratos RPC de conversaciones.',
  991
);

insert into public.provider_skills (provider_user_id, skill_id)
values (
  '04500000-0000-4000-8000-000000000002',
  '04520000-0000-4000-8000-000000000001'
);

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description,
  modality, price_model, price_amount, currency_code, schedule_type,
  is_published
) values (
  '04530000-0000-4000-8000-000000000001',
  '04500000-0000-4000-8000-000000000002',
  '04520000-0000-4000-8000-000000000001',
  'phase04-rpc-service',
  'Servicio RPC Phase04',
  'Servicio sintético suficientemente descriptivo para probar el inicio contextual.',
  'REMOTE',
  'FIXED',
  120000,
  'ARS',
  'UNSCHEDULED',
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '04500000-0000-4000-8000-000000000001',
  true
);

select ok(
  public.start_service_conversation('phase04-rpc-provider', 'phase04-rpc-service') is not null,
  'client starts a contextual conversation from a public service'
);
select is(
  public.start_service_conversation('phase04-rpc-provider', 'phase04-rpc-service'),
  public.start_service_conversation('phase04-rpc-provider', 'phase04-rpc-service'),
  'repeated contextual start is idempotent'
);
select is(
  (select count(*)::integer from public.conversation_participants),
  2,
  'start creates exactly the client and provider participants'
);
select is(
  (select count(*)::integer from public.list_my_conversations(20, null, null)),
  1,
  'client inbox returns the contextual conversation'
);

select set_config(
  'request.jwt.claim.sub',
  '04500000-0000-4000-8000-000000000002',
  true
);

select is(
  (select count(*)::integer
   from public.get_conversation_context(
     public.start_service_conversation('phase04-rpc-provider', 'phase04-rpc-service')
   )),
  0,
  'provider cannot start a conversation with their own service'
);

select throws_ok(
  $$select public.start_service_conversation('phase04-rpc-provider', 'phase04-rpc-service')$$,
  '22023',
  null,
  'provider cannot self-start a contextual conversation'
);

select set_config(
  'request.jwt.claim.sub',
  '04500000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$select * from public.get_conversation_context(
    (select id from public.conversations where service_id = '04530000-0000-4000-8000-000000000001')
  )$$,
  '42501',
  null,
  'outsider cannot retrieve another users conversation context'
);

select * from finish();
rollback;
