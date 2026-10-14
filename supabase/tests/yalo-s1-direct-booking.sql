-- YALO S1: reserva directa con preautorizacion explicita.
-- Sin flag/estado/disponibilidad nace solicitud OPEN (bilateral); con
-- preautorizacion real auto-confirma y reserva capacidad. Todo hace
-- rollback al final del archivo.
begin;

select plan(26);

-- Estructura: flag de preautorizacion.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services'
      and column_name = 'instant_booking_enabled'
  ),
  'services carry an instant booking preauthorization flag'
);
select ok(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'services'
     and column_name = 'instant_booking_enabled') = 'boolean',
  'preauthorization flag is boolean'
);
select ok(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'services'
     and column_name = 'instant_booking_enabled') = 'NO',
  'preauthorization flag is not null'
);
select ok(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'services'
     and column_name = 'instant_booking_enabled') = 'false',
  'preauthorization flag defaults to off'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_provider_services'
      and column_name = 'instant_booking_enabled'
  ),
  'public service view exposes the preauthorization flag'
);

-- Estructura: idempotencia de creacion.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals'
      and column_name = 'idempotency_key' and is_nullable = 'YES'
  ),
  'proposals carry a nullable idempotency key'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'proposals'
      and indexname = 'proposals_conversation_idempotency_key_uniq'
  ),
  'idempotency key has a per-conversation unique index'
);

-- Firmas: overload nuevo + historico vigente.
select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)'))
  like '%request_idempotency_key%',
  'proposal creation accepts an idempotency key'
);
select ok(
  to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz)') is not null,
  'historic eight-arg proposal creation keeps working'
);
select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.save_service_with_tags(uuid,uuid,text,text,public.service_modality,public.price_model,bigint,text,text,boolean,integer,public.schedule_type,text,text,text,boolean,boolean,text[],boolean)'))
  like '%requested_instant_booking_enabled%',
  'service save accepts the preauthorization flag'
);
select ok(
  to_regprocedure('public.save_service_with_tags(uuid,uuid,text,text,public.service_modality,public.price_model,bigint,text,text,boolean,integer,public.schedule_type,text,text,text,boolean,boolean,text[])') is not null,
  'historic service save keeps working'
);

-- Logica endurecida presente en la definicion vigente.
select ok(
  (select pg_get_functiondef(to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)')))
  like '%instant_booking_enabled%',
  'direct booking checks the preauthorization flag'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)')))
  like '%DIRECT_BOOKING_REQUESTED%',
  'missing preauthorization stays a bilateral request'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)')))
  like '%provider_slot_is_available%',
  'scheduled direct booking verifies slot availability'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)')))
  like '%conversation proposals are blocked%',
  'hardened path keeps the conversation block guard'
);

-- Permisos del overload nuevo.
select ok(
  has_function_privilege('authenticated', 'public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)', 'EXECUTE'),
  'idempotent proposal creation is authenticated-only'
);

-- Fixtures S1 prefijo 1500; todo hace rollback al final del archivo.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '15000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    's1-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S1 Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '15000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    's1-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S1 Provider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '15000000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  's1-provider',
  'S1 provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select
  '15000000-0000-4000-8000-000000000002',
  skill.id
from public.skills skill
where skill.is_active
order by skill.sort_order, skill.id
limit 1;

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description,
  modality, price_model, price_amount, currency_code, accepts_offers,
  schedule_type, is_published
)
select
  '15000000-0000-4000-8000-000000000010',
  '15000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  's1-service',
  'S1 service',
  'Synthetic S1 direct booking service fixture for preauthorization.',
  'REMOTE', 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from public.provider_skills provider_skill
where provider_skill.provider_user_id = '15000000-0000-4000-8000-000000000002'
limit 1;

insert into public.conversations (
  id, service_id, client_user_id, provider_user_id, status
) values (
  '15000000-0000-4000-8000-000000000020',
  '15000000-0000-4000-8000-000000000010',
  '15000000-0000-4000-8000-000000000001',
  '15000000-0000-4000-8000-000000000002',
  'OPEN'
);

select set_config('request.jwt.claim.sub', '15000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Sin flag: nace solicitud OPEN, sin trabajo, con evento bilateral.
select is(
  (select status::text from public.proposals
   where id = public.create_conversation_proposal(
     '15000000-0000-4000-8000-000000000020', 'DIRECT_BOOKING', null, null,
     null, null, null, null, '15000000-0000-4000-8000-0000000000a1')),
  'OPEN',
  'direct booking without preauthorization stays open'
);
select is(
  (select count(*)::integer from public.jobs
   where conversation_id = '15000000-0000-4000-8000-000000000020'),
  0,
  'no job is created without preauthorization'
);
select ok(
  exists (
    select 1 from public.proposal_events
    where proposal_id = (select id from public.proposals where idempotency_key = '15000000-0000-4000-8000-0000000000a1')
      and event_type = 'DIRECT_BOOKING_REQUESTED'
  ),
  'missing preauthorization is announced as a bilateral request'
);

-- Con flag + ACTIVE: auto-confirma y crea el trabajo.
update public.services set instant_booking_enabled = true
where id = '15000000-0000-4000-8000-000000000010';

select is(
  (select status::text from public.proposals
   where id = public.create_conversation_proposal(
     '15000000-0000-4000-8000-000000000020', 'DIRECT_BOOKING', null, null,
     null, null, null, null, '15000000-0000-4000-8000-0000000000a2')),
  'ACCEPTED',
  'direct booking with preauthorization is accepted'
);
select is(
  (select status::text from public.jobs
   where accepted_proposal_version_id = (
     select current_version_id from public.proposals
     where idempotency_key = '15000000-0000-4000-8000-0000000000a2')),
  'CONFIRMED',
  'preauthorized direct booking creates a confirmed job'
);

-- Prestador no ACTIVE: vuelve a solicitud aunque el flag siga ON.
update public.provider_profiles set status = 'SUSPENDED'
where user_id = '15000000-0000-4000-8000-000000000002';

select is(
  (select status::text from public.proposals
   where id = public.create_conversation_proposal(
     '15000000-0000-4000-8000-000000000020', 'DIRECT_BOOKING', null, null,
     null, null, null, null, '15000000-0000-4000-8000-0000000000a3')),
  'OPEN',
  'suspended provider cannot self-confirm a booking'
);
select is(
  (select count(*)::integer from public.jobs
   where conversation_id = '15000000-0000-4000-8000-000000000020'),
  1,
  'no second job is created without preauthorization'
);

-- Idempotencia: repetir la clave devuelve la misma propuesta.
select is(
  public.create_conversation_proposal(
    '15000000-0000-4000-8000-000000000020', 'DIRECT_BOOKING', null, null,
    null, null, null, null, '15000000-0000-4000-8000-0000000000a2')::text,
  (select id::text from public.proposals
   where idempotency_key = '15000000-0000-4000-8000-0000000000a2'),
  'repeat idempotency key returns the same proposal'
);
select is(
  (select count(*)::integer from public.proposals
   where idempotency_key = '15000000-0000-4000-8000-0000000000a2'),
  1,
  'repeat key creates no duplicate proposal'
);

-- El prestador no puede auto-reservarse via RPC directo.
select set_config('request.jwt.claim.sub', '15000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select public.create_conversation_proposal(
    '15000000-0000-4000-8000-000000000020', 'DIRECT_BOOKING', null, null,
    null, null, null, null, '15000000-0000-4000-8000-0000000000a4')$$,
  '42501', 'only the client can create a direct booking',
  'provider cannot direct-book its own service'
);

select * from finish();
rollback;
