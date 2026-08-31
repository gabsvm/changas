begin;

select plan(18);

select ok(
  to_regclass('public.conversations') is not null,
  'conversations table exists'
);
select ok(
  to_regclass('public.conversation_participants') is not null,
  'conversation participants table exists'
);
select ok(
  to_regclass('public.messages') is not null,
  'messages table exists'
);
select ok(
  to_regclass('public.message_attachments') is not null,
  'message attachments table exists'
);
select ok(
  to_regclass('public.conversation_reads') is not null,
  'conversation read cursors table exists'
);
select ok(
  to_regclass('public.user_blocks') is not null,
  'user blocks table exists'
);
select ok(
  to_regclass('public.conversation_reports') is not null,
  'conversation reports table exists'
);
select ok(
  to_regclass('public.conversation_moderation_events') is not null,
  'conversation moderation events table exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'messages keep RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.conversations'::regclass),
  'conversations keep RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.conversations', 'SELECT')
  and not has_table_privilege('anon', 'public.messages', 'SELECT'),
  'anonymous users have no direct conversation or message reads'
);
select ok(
  has_table_privilege('authenticated', 'public.conversations', 'SELECT')
  and has_table_privilege('authenticated', 'public.messages', 'SELECT')
  and not has_table_privilege('authenticated', 'public.messages', 'INSERT, UPDATE, DELETE'),
  'authenticated access is read-only at table level'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '04400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'phase04-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase04 Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '04400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'phase04-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase04 Provider"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '04400000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'phase04-outsider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"Phase04 Outsider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '04400000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  'phase04-provider',
  'Proveedor sintético para conversaciones'
);

insert into public.categories (id, slug, name, description, sort_order)
values (
  '04410000-0000-4000-8000-000000000001',
  'phase04-category',
  'Phase04 Category',
  'Categoría sintética exclusiva del test de conversaciones.',
  990
);

insert into public.skills (id, category_id, slug, name, description, sort_order)
values (
  '04420000-0000-4000-8000-000000000001',
  '04410000-0000-4000-8000-000000000001',
  'phase04-skill',
  'Phase04 Skill',
  'Habilidad sintética exclusiva del test de conversaciones.',
  990
);

insert into public.provider_skills (provider_user_id, skill_id)
values (
  '04400000-0000-4000-8000-000000000002',
  '04420000-0000-4000-8000-000000000001'
);

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description,
  modality, price_model, price_amount, currency_code, schedule_type,
  is_published
) values (
  '04430000-0000-4000-8000-000000000001',
  '04400000-0000-4000-8000-000000000002',
  '04420000-0000-4000-8000-000000000001',
  'phase04-service',
  'Servicio Phase04',
  'Servicio sintético suficientemente descriptivo para probar aislamiento de conversaciones.',
  'REMOTE',
  'FIXED',
  100000,
  'ARS',
  'UNSCHEDULED',
  true
);

insert into public.conversations (
  id, service_id, client_user_id, provider_user_id
) values (
  '04440000-0000-4000-8000-000000000001',
  '04430000-0000-4000-8000-000000000001',
  '04400000-0000-4000-8000-000000000001',
  '04400000-0000-4000-8000-000000000002'
);

insert into public.conversation_participants (
  conversation_id, user_id, role
) values
  (
    '04440000-0000-4000-8000-000000000001',
    '04400000-0000-4000-8000-000000000001',
    'CLIENT'
  ),
  (
    '04440000-0000-4000-8000-000000000001',
    '04400000-0000-4000-8000-000000000002',
    'PROVIDER'
  );

insert into public.messages (
  id, conversation_id, sender_user_id, kind, body, client_nonce
) values (
  '04450000-0000-4000-8000-000000000001',
  '04440000-0000-4000-8000-000000000001',
  '04400000-0000-4000-8000-000000000001',
  'TEXT',
  'Mensaje sintético del cliente.',
  '04460000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '04400000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.conversations),
  1,
  'client participant can read the conversation'
);
select is(
  (select count(*)::integer from public.messages),
  1,
  'client participant can read messages'
);
select is(
  (select count(*)::integer from public.conversation_participants),
  2,
  'participant can read both participant rows for their conversation'
);

select set_config(
  'request.jwt.claim.sub',
  '04400000-0000-4000-8000-000000000003',
  true
);

select is(
  (select count(*)::integer from public.conversations),
  0,
  'outsider cannot read another users conversation'
);
select is(
  (select count(*)::integer from public.messages),
  0,
  'outsider cannot read another users messages'
);
select is(
  (select count(*)::integer from public.conversation_participants),
  0,
  'outsider cannot enumerate conversation participants'
);

select * from finish();
rollback;
