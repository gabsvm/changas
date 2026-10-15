-- YALO S4: dinero bilateral con pagos OFF (SPEC 7.2/7.3).
-- Declarar, confirmar de a ambos, contestar con motivo, anular y
-- reemplazar, topes contra el total acordado, RLS por partes y ledger.
-- Todo hace rollback al final del archivo.
begin;

select plan(38);

-- Estructura: tabla, estados, RLS y firmas.
select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'external_payment_declarations'
  ),
  'external money lives in its own declarations'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'external_payment_state' and e.enumlabel = 'DECLARED_BY_CLIENT'
  ),
  'declaration states name the client side'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'external_payment_state' and e.enumlabel = 'CONFIRMED_BY_BOTH'
  ),
  'declaration states name the joint confirmation'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'external_payment_state' and e.enumlabel = 'CONTESTED'
  ),
  'declaration states name the disagreement'
);
select ok(
  exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'external_payment_state' and e.enumlabel = 'VOIDED'
  ),
  'declaration states name the void path'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.external_payment_declarations'::regclass),
  'declarations enforce row level security'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'external_payment_declarations'
      and policyname = 'external_payment_select_parties'
  ),
  'declarations are readable by the job parties'
);
select ok(
  to_regprocedure('public.external_payment_ledger(uuid)') is not null,
  'bilateral ledger exists'
);
select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.declare_external_payment(uuid,bigint,text,date,text,uuid,uuid)'))
  like '%request_idempotency_key%',
  'declaration accepts an idempotency key'
);
select ok(
  has_function_privilege('authenticated', 'public.declare_external_payment(uuid,bigint,text,date,text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.declare_external_payment(uuid,bigint,text,date,text,uuid,uuid)', 'EXECUTE'),
  'declaration is authenticated-only'
);
select ok(
  to_regprocedure('public.respond_external_payment(uuid,boolean,text)') is not null,
  'counterpart response exists'
);
select ok(
  to_regprocedure('public.void_external_payment(uuid)') is not null,
  'declarer void exists'
);

-- Fixtures S4 prefijo 1800; todo hace rollback al final del archivo.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '18000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    's4-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S4 Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '18000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    's4-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S4 Provider"}'
  ),
  (
    '00000000-0000-4000-8000-000000000000',
    '18000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated',
    's4-outsider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S4 Outsider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '18000000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  's4-provider',
  'S4 provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select
  '18000000-0000-4000-8000-000000000002',
  skill.id
from public.skills skill
where skill.is_active
order by skill.sort_order, skill.id
limit 1
on conflict do nothing;

insert into public.services (
  id, provider_user_id, skill_id, public_slug, title, description,
  modality, price_model, price_amount, currency_code, accepts_offers,
  schedule_type, is_published
)
select
  '18000000-0000-4000-8000-0000000000' || suffix,
  '18000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  's4-service-' || suffix,
  'S4 service ' || suffix,
  'Synthetic S4 bilateral money fixture.',
  'REMOTE', 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from (values ('10'), ('11'), ('12')) as variants(suffix)
cross join (
  select skill_id
  from public.provider_skills
  where provider_user_id = '18000000-0000-4000-8000-000000000002'
  limit 1
) as provider_skill;

-- Tres trabajos remotos: dos COMPLETED y uno en CONFIRMED.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.start_service_conversation('s4-provider', 's4-service-10');
select public.start_service_conversation('s4-provider', 's4-service-11');
select public.start_service_conversation('s4-provider', 's4-service-12');

select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select public.create_conversation_proposal(
  (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010'),
  'PROVIDER_QUOTE', null, 100000, null, null, null, null,
  '18000000-0000-4000-8000-0000000000a1'
);
select public.create_conversation_proposal(
  (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011'),
  'PROVIDER_QUOTE', null, 100000, null, null, null, null,
  '18000000-0000-4000-8000-0000000000a2'
);
select public.create_conversation_proposal(
  (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000012'),
  'PROVIDER_QUOTE', null, 100000, null, null, null, null,
  '18000000-0000-4000-8000-0000000000a3'
);

select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select public.respond_to_proposal(
  (select id from public.proposals where idempotency_key = '18000000-0000-4000-8000-0000000000a1'),
  'ACCEPT'
);
select public.respond_to_proposal(
  (select id from public.proposals where idempotency_key = '18000000-0000-4000-8000-0000000000a2'),
  'ACCEPT'
);
select public.respond_to_proposal(
  (select id from public.proposals where idempotency_key = '18000000-0000-4000-8000-0000000000a3'),
  'ACCEPT'
);

select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select public.transition_job_status(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
  'CONFIRMED', 'IN_PROGRESS', null, null
);
select public.transition_job_status(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  'CONFIRMED', 'IN_PROGRESS', null, null
);
select public.submit_job_delivery(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
  'Entrega digital para Conciliacion.'
);
select public.submit_job_delivery(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  'Segunda entrega digital para Conciliacion.'
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select public.transition_job_status(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
  'COMPLETION_REQUESTED', 'COMPLETED', null, null
);
select public.transition_job_status(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  'COMPLETION_REQUESTED', 'COMPLETED', null, null
);

-- Declarar: el cliente informa, idempotente por clave.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select ok(
  public.declare_external_payment(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
    60000, 'TRANSFERENCIA', null, 'cuota 1',
    '18000000-0000-4000-8000-0000000000b1', null
  ) is not null,
  'client declaration returns an id'
);
select is(
  (select state::text from public.external_payment_declarations
   where idempotency_key = '18000000-0000-4000-8000-0000000000b1'),
  'DECLARED_BY_CLIENT',
  'client declaration names its side'
);
select is(
  public.declare_external_payment(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
    60000, 'TRANSFERENCIA', null, 'cuota 1',
    '18000000-0000-4000-8000-0000000000b1', null
  )::text,
  (select id::text from public.external_payment_declarations
   where idempotency_key = '18000000-0000-4000-8000-0000000000b1'),
  'repeat key returns the same declaration'
);

-- Confirmar: solo la contraparte, con tope acordado.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select is(
  public.respond_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b1'),
    true, null
  ),
  'CONFIRMED_BY_BOTH',
  'counterpart confirmation reconciles the payment'
);
select is(
  (select external_confirmed_minor from public.external_payment_ledger(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010'))
  )),
  60000,
  'ledger counts the confirmed payment'
);
select is(
  (select external_outstanding_minor from public.external_payment_ledger(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010'))
  )),
  40000,
  'ledger keeps the outstanding balance'
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.respond_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b1'),
    true, null)$$,
  '42501', 'only the counterpart responds to a declaration',
  'declarer cannot confirm its own payment'
);

-- Topes: ni declarar ni confirmar por encima del acuerdo.
select throws_ok(
  $$select public.declare_external_payment(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
    200000, 'EFECTIVO', null, null,
    '18000000-0000-4000-8000-0000000000b2', null)$$,
  '22023', 'declared amount exceeds the agreed total',
  'over-agreement declaration is rejected'
);

-- Confirmar por encima del acuerdo con dos parciales también se rechaza.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select public.declare_external_payment(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
  50000, 'TRANSFERENCIA', null, null,
  '18000000-0000-4000-8000-0000000000b9', null
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.respond_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b9'),
    true, null)$$,
  '22023', 'confirmed amount exceeds the agreed total',
  'second partial confirmation past the agreement is rejected'
);

-- Contestar con motivo congela sin revertir el trabajo.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select public.declare_external_payment(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  40000, 'EFECTIVO', null, null,
  '18000000-0000-4000-8000-0000000000b3', null
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select is(
  public.respond_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b3'),
    false, 'No recibi ese monto.'
  ),
  'CONTESTED',
  'counterpart contest freezes the payment'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  'COMPLETED',
  'contested money never reverts the job'
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select public.declare_external_payment(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  40000, 'EFECTIVO', null, null,
  '18000000-0000-4000-8000-0000000000b4', null
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.respond_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b4'),
    false, null)$$,
  '22023', 'a reason is required to contest a declaration',
  'contest without reason is rejected'
);

-- Reemplazar solo lo propio: la contraparte no puede.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.declare_external_payment(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
    10000, 'EFECTIVO', null, null,
    '18000000-0000-4000-8000-0000000000bA',
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b4'))$$,
  '42501', 'only the declarer supersedes a declaration',
  'counterpart cannot supersede the declaration'
);

-- Reemplazar lo propio anula la anterior y enlaza la nueva.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select public.declare_external_payment(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000011')),
  30000, 'TRANSFERENCIA', null, 'corrección',
  '18000000-0000-4000-8000-0000000000bB',
  (select id from public.external_payment_declarations
   where idempotency_key = '18000000-0000-4000-8000-0000000000b4')
);
select is(
  (select state::text from public.external_payment_declarations
   where idempotency_key = '18000000-0000-4000-8000-0000000000b4'),
  'VOIDED',
  'superseded declaration is voided'
);
select is(
  (select supersedes_id from public.external_payment_declarations
   where idempotency_key = '18000000-0000-4000-8000-0000000000bB'),
  (select id from public.external_payment_declarations
   where idempotency_key = '18000000-0000-4000-8000-0000000000b4'),
  'replacement links the voided declaration'
);

-- Anular: solo quien declaro, solo pendiente.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select public.declare_external_payment(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
  10000, 'EFECTIVO', null, null,
  '18000000-0000-4000-8000-0000000000b5', null
);
select is(
  public.void_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b5')
  ),
  'VOIDED',
  'declarer voids its pending declaration'
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select public.declare_external_payment(
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
  10000, 'EFECTIVO', null, null,
  '18000000-0000-4000-8000-0000000000b6', null
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.void_external_payment(
    (select id from public.external_payment_declarations
     where idempotency_key = '18000000-0000-4000-8000-0000000000b6'))$$,
  '42501', 'only the declarer voids a declaration',
  'counterpart cannot void the declaration'
);

-- Fuera de COMPLETED el historial se congela: ni responder ni anular.
-- (Inserción directa de fixture: el trabajo CONFIRMED no admite declarar.)
insert into public.external_payment_declarations (
  job_id, declared_by_user_id, amount_minor, method, state
)
select
  (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000012')),
  '18000000-0000-4000-8000-000000000001',
  70000, 'TRANSFERENCIA', 'DECLARED_BY_CLIENT';
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.respond_external_payment(
    (select d.id from public.external_payment_declarations d
     join public.jobs j on j.id = d.job_id
     join public.conversations c on c.id = j.conversation_id
     where c.service_id = '18000000-0000-4000-8000-000000000012'
       and d.amount_minor = 70000),
    true, null)$$,
  '22023', 'external money is registered only on completed jobs',
  'uncompleted job takes no responses'
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.void_external_payment(
    (select d.id from public.external_payment_declarations d
     join public.jobs j on j.id = d.job_id
     join public.conversations c on c.id = j.conversation_id
     where c.service_id = '18000000-0000-4000-8000-000000000012'
       and d.amount_minor = 70000))$$,
  '22023', 'external money is registered only on completed jobs',
  'uncompleted job takes no voids'
);

-- Dinero solo en COMPLETED; ajenos no ven ni tocan.
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.declare_external_payment(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000012')),
    10000, 'EFECTIVO', null, null,
    '18000000-0000-4000-8000-0000000000b7', null)$$,
  '22023', 'external money is registered only on completed jobs',
  'uncompleted job takes no declarations'
);
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.declare_external_payment(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '18000000-0000-4000-8000-000000000010')),
    10000, 'EFECTIVO', null, null,
    '18000000-0000-4000-8000-0000000000b8', null)$$,
  '42501', 'job access denied',
  'outsider cannot declare on the job'
);
set role authenticated;
select is(
  (select count(*)::integer from public.external_payment_declarations),
  0,
  'outsider reads no declarations'
);
reset role;
-- Precio privado: helper interno no es RPC ejecutable por cualquier usuario.
select ok(
  not has_function_privilege('authenticated', 'public.external_agreed_total_for_job(uuid)', 'EXECUTE'),
  'outsider authenticated role cannot execute private price helper'
);
select ok(
  has_function_privilege('service_role', 'public.external_agreed_total_for_job(uuid)', 'EXECUTE'),
  'service role can invoke the internal price helper'
);

select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
-- Precio acordado externo incluye adicional aceptado aunque MP este OFF.
-- Status AWAITING_PAYMENT significa consentimiento contractual sin checkout.
insert into public.job_scope_changes (
  job_id, requested_by_user_id, status, scope_snapshot,
  additional_amount_minor, currency_code
) values (
  (select j.id from public.jobs j
   where j.service_id = '18000000-0000-4000-8000-000000000010'),
  '18000000-0000-4000-8000-000000000002',
  'AWAITING_PAYMENT', 'Adicional de materiales aprobado sin checkout.',
  30000, 'ARS'
);
select is(
  (select agreed_total_minor from public.external_payment_ledger(
    (select j.id from public.jobs j
     where j.service_id = '18000000-0000-4000-8000-000000000010')
  )),
  130000,
  'agreed total includes 100000 base plus 30000 accepted additional'
);
select is(
  (select external_outstanding_minor from public.external_payment_ledger(
    (select j.id from public.jobs j
     where j.service_id = '18000000-0000-4000-8000-000000000010')
  )),
  70000,
  'confirmed 60000 leaves 70000 including accepted additional'
);
select * from finish();
rollback;
