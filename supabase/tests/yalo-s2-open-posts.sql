-- YALO S2: necesidad abierta (camino B).
-- job_posts con dueno, RLS de lectura OPEN, RPC idempotente y gobierno
-- del dueno OPEN<->PAUSED + cierre; auto-cierre al contratar.
-- Todo hace rollback al final del archivo.
begin;

select plan(69);

-- Estructura: tablas y columnas.
select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'job_posts'
  ),
  'open need posts live in job posts'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts'
      and column_name = 'owner_user_id'
  ),
  'posts carry an owner'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts'
      and column_name = 'skill_id'
  ),
  'posts reference a skill'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts'
      and column_name = 'title'
  ),
  'posts carry a title'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts'
      and column_name = 'description'
  ),
  'posts carry a description'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts'
      and column_name = 'status'
  ),
  'posts carry a status'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_posts'
      and column_name = 'idempotency_key'
  ),
  'posts carry an idempotency key'
);
select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'job_post_events'
  ),
  'post lifecycle lives in post events'
);

-- Enum de estado con los cuatro valores.
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'job_post_status' and e.enumlabel = 'OPEN'
  ),
  'post status offers open'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'job_post_status' and e.enumlabel = 'PAUSED'
  ),
  'post status offers paused'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'job_post_status' and e.enumlabel = 'CLOSED'
  ),
  'post status offers closed'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'job_post_status' and e.enumlabel = 'HIRED'
  ),
  'post status offers hired'
);
select ok(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'job_posts'
     and column_name = 'status') = '''OPEN''::public.job_post_status',
  'posts default to open'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'job_posts'
      and indexname = 'job_posts_owner_idempotency_uniq'
  ),
  'owner idempotency key has a unique index'
);

-- RLS: lectura propia o abierta; eventos solo del dueno.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_posts'::regclass),
  'posts enforce row level security'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'job_posts'
      and policyname = 'job_posts_select_own_or_open'
  ),
  'posts are readable by the owner or when open'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_post_events'::regclass),
  'post events enforce row level security'
);

-- Firmas de los RPC.
select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.create_job_post(uuid,text,text,text,timestamptz,timestamptz,bigint,text,uuid)'))
  like '%request_idempotency_key%',
  'post creation accepts an idempotency key'
);
select ok(
  has_function_privilege('authenticated', 'public.create_job_post(uuid,text,text,text,timestamptz,timestamptz,bigint,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_job_post(uuid,text,text,text,timestamptz,timestamptz,bigint,text,uuid)', 'EXECUTE'),
  'post creation is authenticated-only'
);
select ok(
  to_regprocedure('public.update_job_post_status(uuid,public.job_post_status)') is not null,
  'owner status transition keeps working'
);
select ok(
  has_function_privilege('authenticated', 'public.update_job_post_status(uuid,public.job_post_status)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_job_post_status(uuid,public.job_post_status)', 'EXECUTE'),
  'status transition is authenticated-only'
);
select ok(
  (select pg_get_functiondef('public.close_job_post_on_hire()'::regprocedure))
  like '%job_post_id%',
  'hiring auto-closes the linked post'
);

-- Fixtures S2 prefijo 1600; todo hace rollback al final del archivo.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '16000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    's2-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S2 Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '16000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    's2-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S2 Provider"}'
  );

select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Crear necesidad valida: nace OPEN con evento.
select ok(
  public.create_job_post(
    (select id from public.skills where is_active order by sort_order, id limit 1),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    'Palermo, CABA', null, null, 80000, 'ARS',
    '16000000-0000-4000-8000-0000000000a1'
  ) is not null,
  'valid post creation returns an id'
);
select is(
  (select status::text from public.job_posts
   where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
  'OPEN',
  'new post starts open'
);
select ok(
  exists (
    select 1 from public.job_post_events
    where job_post_id = (select id from public.job_posts
      where idempotency_key = '16000000-0000-4000-8000-0000000000a1')
      and event_type = 'POST_CREATED'
  ),
  'new post announces its creation'
);

-- Idempotencia: repetir la clave devuelve el mismo post.
select is(
  public.create_job_post(
    (select id from public.skills where is_active order by sort_order, id limit 1),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    'Palermo, CABA', null, null, 80000, 'ARS',
    '16000000-0000-4000-8000-0000000000a1'
  )::text,
  (select id::text from public.job_posts
   where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
  'repeat idempotency key returns the same post'
);
select is(
  (select count(*)::integer from public.job_posts
   where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
  1,
  'repeat key creates no duplicate post'
);

-- Validacion: titulo, descripcion, rubro, agenda y presupuesto.
select throws_ok(
  $$select public.create_job_post(
    (select id from public.skills where is_active order by sort_order, id limit 1),
    'Corto', 'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    null, null, null, null, 'ARS',
    '16000000-0000-4000-8000-0000000000b1')$$,
  '22023', 'post title is invalid',
  'short title is rejected'
);
select throws_ok(
  $$select public.create_job_post(
    (select id from public.skills where is_active order by sort_order, id limit 1),
    'Necesito plomero urgente en casa', 'Muy corta.',
    null, null, null, null, 'ARS',
    '16000000-0000-4000-8000-0000000000b2')$$,
  '22023', 'post description is invalid',
  'short description is rejected'
);
select throws_ok(
  $$select public.create_job_post(
    '16000000-0000-4000-8000-00000000dead',
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    null, null, null, null, 'ARS',
    '16000000-0000-4000-8000-0000000000b3')$$,
  '22023', 'skill is not available',
  'unknown skill is rejected'
);
select throws_ok(
  $$select public.create_job_post(
    (select id from public.skills where is_active order by sort_order, id limit 1),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    null, '2030-05-10T12:00:00Z', '2030-05-10T10:00:00Z', null, 'ARS',
    '16000000-0000-4000-8000-0000000000b4')$$,
  '22023', 'schedule end must be after start',
  'inverted schedule is rejected'
);
select throws_ok(
  $$select public.create_job_post(
    (select id from public.skills where is_active order by sort_order, id limit 1),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    null, null, null, -500, 'ARS',
    '16000000-0000-4000-8000-0000000000b5')$$,
  '22023', 'budget must be positive',
  'negative budget is rejected'
);

-- Gobierno: solo el dueno transiciona.
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
    'PAUSED')$$,
  '42501', 'only the owner governs the post',
  'provider cannot govern the post'
);

-- RLS: el prestador ve la necesidad abierta...
select is(
  (select count(*)::integer from public.job_posts),
  1,
  'provider sees the open post'
);

-- ...el dueno la pausa y desaparece del listado...
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select is(
  public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
    'PAUSED'
  )::text,
  'PAUSED',
  'owner pauses the post'
);
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.job_posts),
  0,
  'paused post hides from providers'
);

-- ...la reabre, la cierra, y el cierre es terminal.
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select is(
  public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
    'OPEN'
  )::text,
  'OPEN',
  'owner reopens the post'
);
select is(
  public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
    'CLOSED'
  )::text,
  'CLOSED',
  'owner closes the post'
);
select throws_ok(
  $$select public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
    'OPEN')$$,
  '22023', 'post transition is invalid',
  'closed post cannot reopen'
);
select throws_ok(
  $$select public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000a1'),
    'PAUSED')$$,
  '22023', 'post transition is invalid',
  'closed post cannot pause'
);
-- Ofertas: el prestador ancla un servicio y abre el hilo 1:1.
select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.start_post_offer_conversation(uuid,uuid)'))
  like '%target_post_id%',
  'offer start names the post and the service'
);
select ok(
  has_function_privilege('authenticated', 'public.start_post_offer_conversation(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.start_post_offer_conversation(uuid,uuid)', 'EXECUTE'),
  'offer start is authenticated-only'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'conversations'
      and indexname = 'job_post_conversation_pair_uniq'
  ),
  'post pair keeps a single offer thread'
);

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '16000000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  's2-provider',
  'S2 provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select
  '16000000-0000-4000-8000-000000000002',
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
  '16000000-0000-4000-8000-000000000010',
  '16000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  's2-service',
  'S2 service',
  'Synthetic S2 offer service fixture for open posts.',
  'REMOTE', 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from public.provider_skills provider_skill
where provider_skill.provider_user_id = '16000000-0000-4000-8000-000000000002'
limit 1;

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description,
  modality, price_model, price_amount, currency_code, accepts_offers,
  schedule_type, is_published
)
select
  '16000000-0000-4000-8000-000000000011',
  '16000000-0000-4000-8000-000000000002',
  services.skill_id,
  's2-service-second',
  'S2 second service',
  'Synthetic S2 second offer service fixture for the hire path.',
  'REMOTE', 'FIXED', 120000, 'ARS', false, 'UNSCHEDULED', true
from public.services
where id = '16000000-0000-4000-8000-000000000010';

select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select ok(
  public.create_job_post(
    (select skill_id from public.services where id = '16000000-0000-4000-8000-000000000010'),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    'Palermo, CABA', null, null, 80000, 'ARS',
    '16000000-0000-4000-8000-0000000000c1'
  ) is not null,
  'second open post is created for offers'
);

select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select ok(
  public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1'),
    '16000000-0000-4000-8000-000000000010'
  ) is not null,
  'provider offer opens a thread'
);
select ok(
  exists (
    select 1 from public.conversations
    where job_post_id = (select id from public.job_posts
      where idempotency_key = '16000000-0000-4000-8000-0000000000c1')
      and client_user_id = '16000000-0000-4000-8000-000000000001'
      and provider_user_id = '16000000-0000-4000-8000-000000000002'
      and service_id = '16000000-0000-4000-8000-000000000010'
  ),
  'offer thread binds post owner provider and service'
);
select is(
  (select count(*)::integer from public.conversation_participants
   where conversation_id = (select id from public.conversations
     where job_post_id = (select id from public.job_posts
       where idempotency_key = '16000000-0000-4000-8000-0000000000c1'))),
  2,
  'offer thread seats both parties'
);
select ok(
  exists (
    select 1 from public.job_post_events
    where job_post_id = (select id from public.job_posts
      where idempotency_key = '16000000-0000-4000-8000-0000000000c1')
      and event_type = 'OFFER_RECEIVED'
  ),
  'offer announces itself on the post'
);
select is(
  public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1'),
    '16000000-0000-4000-8000-000000000010'
  )::text,
  (select id::text from public.conversations
   where job_post_id = (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1')),
  'repeat offer returns the same thread'
);
select is(
  (select count(*)::integer from public.conversations
   where job_post_id = (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1')),
  1,
  'repeat offer creates no duplicate thread'
);

-- Quien no es dueno del servicio no puede ofertar con el.
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1'),
    '16000000-0000-4000-8000-000000000010')$$,
  '42501', 'offer service is not available',
  'client cannot offer with another service'
);

-- El bloqueo del par frena la oferta.
insert into public.user_blocks (conversation_id, blocker_user_id, blocked_user_id) values (
  (select id from public.conversations
   where job_post_id = (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1')),
  '16000000-0000-4000-8000-000000000001',
  '16000000-0000-4000-8000-000000000002'
);
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1'),
    '16000000-0000-4000-8000-000000000010')$$,
  '42501', 'conversation start is blocked',
  'blocked pair cannot start an offer'
);
delete from public.user_blocks
where blocker_user_id = '16000000-0000-4000-8000-000000000001';

-- En post cerrado no se oferta.
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select is(
  public.update_job_post_status(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1'),
    'CLOSED'
  )::text,
  'CLOSED',
  'second post closes before the offer attempt'
);
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000c1'),
    '16000000-0000-4000-8000-000000000010')$$,
  '22023', 'post is not open',
  'closed post takes no offers'
);
-- Indices de los listados nuevos.
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'job_posts'
      and indexname = 'job_posts_open_skill_created_idx'
  ),
  'open post listing has a supporting index'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'conversations'
      and indexname = 'conversations_job_post_idx'
  ),
  'post-bound threads have a supporting index'
);

-- Reuse-and-bind: un hilo de catalogo libre se adopta al post.
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select ok(
  public.create_job_post(
    (select skill_id from public.services where id = '16000000-0000-4000-8000-000000000010'),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    null, null, null, null, 'ARS',
    '16000000-0000-4000-8000-0000000000e1'
  ) is not null,
  'third open post is created for adoption'
);
select ok(
  public.start_service_conversation('s2-provider', 's2-service') is not null,
  'catalog thread opens before the offer'
);
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select is(
  public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000e1'),
    '16000000-0000-4000-8000-000000000010'
  )::text,
  (select id::text from public.conversations
   where service_id = '16000000-0000-4000-8000-000000000010'
     and client_user_id = '16000000-0000-4000-8000-000000000001'
     and provider_user_id = '16000000-0000-4000-8000-000000000002'),
  'offer adopts the free catalog thread'
);
select ok(
  (select job_post_id from public.conversations
   where service_id = '16000000-0000-4000-8000-000000000010'
     and client_user_id = '16000000-0000-4000-8000-000000000001'
     and provider_user_id = '16000000-0000-4000-8000-000000000002')
  = (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000e1'),
  'adopted thread points at the post'
);
select ok(
  exists (
    select 1 from public.job_post_events
    where job_post_id = (select id from public.job_posts
      where idempotency_key = '16000000-0000-4000-8000-0000000000e1')
      and event_type = 'OFFER_RECEIVED'
  ),
  'adoption announces the offer on the post'
);

-- Auto-hire: aceptar la oferta del hilo atado marca HIRED.
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select ok(
  public.create_job_post(
    (select skill_id from public.services where id = '16000000-0000-4000-8000-000000000010'),
    'Necesito plomero urgente en casa',
    'Se rompio un cano bajo la bacha y necesito arreglo esta semana.',
    null, null, null, null, 'ARS',
    '16000000-0000-4000-8000-0000000000d1'
  ) is not null,
  'fourth open post is created for hiring'
);
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select ok(
  public.start_post_offer_conversation(
    (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000d1'),
    '16000000-0000-4000-8000-000000000011'
  ) is not null,
  'offer opens a thread for the hire post'
);
select is(
  (select count(*)::integer from public.conversations
   where job_post_id = (select id from public.job_posts
     where idempotency_key = '16000000-0000-4000-8000-0000000000d1')),
  1,
  'hire post keeps a single thread'
);
select ok(
  exists (
    select 1 from public.conversations
    where job_post_id = (select id from public.job_posts
      where idempotency_key = '16000000-0000-4000-8000-0000000000d1')
      and service_id = '16000000-0000-4000-8000-000000000011'
  ),
  'hire thread anchors the second service'
);
select ok(
  public.create_conversation_proposal(
    (select id from public.conversations
     where job_post_id = (select id from public.job_posts
       where idempotency_key = '16000000-0000-4000-8000-0000000000d1')),
    'PROVIDER_QUOTE', null, 100000, null, null, null, null,
    '16000000-0000-4000-8000-0000000000d2'
  ) is not null,
  'provider quotes on the bound thread'
);
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000001', true);
select is(
  public.respond_to_proposal(
    (select id from public.proposals
     where idempotency_key = '16000000-0000-4000-8000-0000000000d2'),
    'ACCEPT'
  )::text,
  'ACCEPTED',
  'client accepts the bound offer'
);
select is(
  (select status::text from public.job_posts
   where idempotency_key = '16000000-0000-4000-8000-0000000000d1'),
  'HIRED',
  'hiring marks the post hired'
);
select ok(
  exists (
    select 1 from public.job_post_events
    where job_post_id = (select id from public.job_posts
      where idempotency_key = '16000000-0000-4000-8000-0000000000d1')
      and event_type = 'AUTO_HIRED_ON_HIRE'
  ),
  'hiring announces itself on the post'
);
select * from finish();
rollback;
