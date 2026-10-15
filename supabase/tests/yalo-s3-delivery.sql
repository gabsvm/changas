-- YALO S3: entrega desacoplada (SPEC 6A/6B/6C).
-- Enviar no pide PIN; el PIN es constancia presencial tras revision;
-- remoto nunca pide PIN; confirmar exige evidencia; autocierre exige
-- evidencia; correccion con motivo y tope. Todo hace rollback al final.
begin;

select plan(56);

-- Estructura: columnas de entrega.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name = 'delivery_submitted_at'
  ),
  'jobs carry a delivery submission timestamp'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name = 'handover_verified_at'
  ),
  'jobs carry a handover verification timestamp'
);
select ok(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'jobs'
     and column_name = 'correction_count') = '0',
  'correction rounds default to zero'
);

-- Firmas nuevas + compuertas en definiciones vigentes.
select ok(
  to_regprocedure('public.submit_job_delivery(uuid,text,text)') is not null,
  'delivery submission RPC exists'
);
select ok(
  to_regprocedure('public.request_job_correction(uuid,text)') is not null,
  'correction request RPC exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'require_completion_evidence_trigger' and not tgisinternal
  ),
  'completion requires evidence at the row level'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.auto_complete_stale_jobs()')))
  like '%delivery_submitted_at%',
  'auto-close checks delivery evidence'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.request_job_completion(uuid,text)')))
  like '%submit the delivery before verifying%',
  'handover check requires a prior submission'
);

-- Modality BOTH must be resolved on the job before digital delivery.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name = 'effective_modality'
  ),
  'jobs persist effective in-person or remote modality'
);
select ok(
  to_regprocedure('public.choose_job_effective_modality(uuid,public.service_modality)') is not null,
  'client can choose an effective modality for a BOTH service'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.choose_job_effective_modality(uuid,public.service_modality)',
    'EXECUTE'
  ),
  'authenticated can call role-authorized modality selector'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.auto_complete_stale_jobs()')))
  like '%effective_modality%',
  'stale job auto-close respects the effective delivery modality'
);

-- Fixtures S3 prefijo 1700; todo hace rollback al final del archivo.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '17000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    's3-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S3 Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '17000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    's3-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"S3 Provider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '17000000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  's3-provider',
  'S3 provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select
  '17000000-0000-4000-8000-000000000002',
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
  '17000000-0000-4000-8000-0000000000' || suffix,
  '17000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  's3-service-' || suffix,
  'S3 service ' || suffix,
  'Synthetic S3 delivery service fixture.',
  modality::public.service_modality, 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from (values ('10', 'IN_PERSON'), ('11', 'REMOTE'), ('12', 'IN_PERSON'), ('13', 'IN_PERSON')) as variants(suffix, modality)
cross join (
  select skill_id
  from public.provider_skills
  where provider_user_id = '17000000-0000-4000-8000-000000000002'
  limit 1
) as provider_skill;

-- Cuatro hilos (uno por servicio); el cliente abre, el prestador cotiza,
-- el cliente acepta: cuatro CONFIRMED.
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  public.start_service_conversation('s3-provider', 's3-service-10') is not null,
  'first thread opens'
);
select ok(
  public.start_service_conversation('s3-provider', 's3-service-11') is not null,
  'second thread opens'
);
select ok(
  public.start_service_conversation('s3-provider', 's3-service-12') is not null,
  'third thread opens'
);
select ok(
  public.start_service_conversation('s3-provider', 's3-service-13') is not null,
  'fourth thread opens'
);

select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000002', true);
select ok(
  public.create_conversation_proposal(
    (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010'),
    'PROVIDER_QUOTE', null, 100000, null, null, null, null,
    '17000000-0000-4000-8000-0000000000a1'
  ) is not null,
  'first quote is created'
);
select ok(
  public.create_conversation_proposal(
    (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011'),
    'PROVIDER_QUOTE', null, 100000, null, null, null, null,
    '17000000-0000-4000-8000-0000000000a2'
  ) is not null,
  'second quote is created'
);
select ok(
  public.create_conversation_proposal(
    (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012'),
    'PROVIDER_QUOTE', null, 100000, null, null, null, null,
    '17000000-0000-4000-8000-0000000000a3'
  ) is not null,
  'third quote is created'
);
select ok(
  public.create_conversation_proposal(
    (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013'),
    'PROVIDER_QUOTE', null, 100000, null, null, null, null,
    '17000000-0000-4000-8000-0000000000a4'
  ) is not null,
  'fourth quote is created'
);

select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select is(
  public.respond_to_proposal(
    (select id from public.proposals where idempotency_key = '17000000-0000-4000-8000-0000000000a1'),
    'ACCEPT'
  )::text,
  'ACCEPTED',
  'first quote is accepted'
);
select is(
  public.respond_to_proposal(
    (select id from public.proposals where idempotency_key = '17000000-0000-4000-8000-0000000000a2'),
    'ACCEPT'
  )::text,
  'ACCEPTED',
  'second quote is accepted'
);
select is(
  public.respond_to_proposal(
    (select id from public.proposals where idempotency_key = '17000000-0000-4000-8000-0000000000a3'),
    'ACCEPT'
  )::text,
  'ACCEPTED',
  'third quote is accepted'
);
select is(
  public.respond_to_proposal(
    (select id from public.proposals where idempotency_key = '17000000-0000-4000-8000-0000000000a4'),
    'ACCEPT'
  )::text,
  'ACCEPTED',
  'fourth quote is accepted'
);

select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000002', true);
select is(
  public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
    'CONFIRMED', 'IN_PROGRESS', null, null
  )::text,
  'IN_PROGRESS',
  'first job starts'
);
select is(
  public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')),
    'CONFIRMED', 'IN_PROGRESS', null, null
  )::text,
  'IN_PROGRESS',
  'second job starts'
);
select is(
  public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    'CONFIRMED', 'IN_PROGRESS', null, null
  )::text,
  'IN_PROGRESS',
  'third job starts'
);
select is(
  public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013')),
    'CONFIRMED', 'IN_PROGRESS', null, null
  )::text,
  'IN_PROGRESS',
  'fourth job starts'
);

-- Presencial: sin envio no hay constancia que verificar.
select throws_ok(
  $$select public.request_job_completion(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
    '0000')$$,
  '22023', 'submit the delivery before verifying the handover code',
  'handover check without submission is rejected'
);

-- Presencial: el envio no pide PIN y no mueve el estado.
select is(
  public.submit_job_delivery(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
    'Trabajo terminado segun lo acordado.'
  ),
  'SUBMITTED',
  'in-person submission needs no code'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
  'IN_PROGRESS',
  'in-person submission waits for the handover check'
);
select ok(
  exists (
    select 1 from public.job_events
    where job_id = (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010'))
      and event_type = 'JOB_DELIVERY_SUBMITTED'
  ),
  'submission is announced'
);
select throws_ok(
  $$select public.submit_job_delivery(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013')),
    'ab')$$,
  '22023', 'delivery summary is invalid',
  'short delivery summary is rejected with a clear error'
);

-- Presencial: codigo erroneo tras el envio suma intento, no cierra.
select is(
  public.request_job_completion(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
    '0000'
  ),
  'MISMATCH',
  'wrong handover code is recorded'
);

-- Presencial: codigo correcto deja constancia y pide revision.
select is(
  public.request_job_completion(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
    (select confirmation_code from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010'))
  ),
  'COMPLETED',
  'correct handover code verifies the handover'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
  'COMPLETION_REQUESTED',
  'verified handover requests the final review'
);
select ok(
  (select handover_verified_at from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')) is not null,
  'handover constancy is timestamped'
);

-- Presencial: el cliente confirma por separado.
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select is(
  public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000010')),
    'COMPLETION_REQUESTED', 'COMPLETED', null, null
  )::text,
  'COMPLETED',
  'client confirms the verified job'
);

-- Remoto: la simple descripcion NO constituye entrega verificable.
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.submit_job_delivery(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')),
    'Texto sin enlace de evidencia.'
  )$$,
  '22023', 'remote delivery requires a valid HTTPS evidence link',
  'remote submission needs HTTPS evidence'
);

-- Remoto: la entrega con enlace mueve a revision, sin PIN.
select is(
  public.submit_job_delivery(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')),
    'Entrega digital lista para revision.',
    'https://example.com/yalo/test-delivery'
  ),
  'SUBMITTED',
  'remote submission needs no code'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')),
  'COMPLETION_REQUESTED',
  'remote submission requests the review at once'
);
select throws_ok(
  $$select public.request_job_completion(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')),
    (select confirmation_code from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')))$$,
  '22023', 'remote delivery needs no code; review the delivery instead',
  'remote handover check is rejected even with the right code'
);
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select is(
  public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000011')),
    'COMPLETION_REQUESTED', 'COMPLETED', null, null
  )::text,
  'COMPLETED',
  'client confirms the remote job without handover'
);

-- Correccion: vuelve a IN_PROGRESS con motivo, cuenta y limpia el ciclo.
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000002', true);
select ok(
  public.submit_job_delivery(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    'Primera version para revision.'
  ) is not null,
  'third job delivery is submitted'
);
select ok(
  public.request_job_completion(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    (select confirmation_code from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012'))
  ) is not null,
  'third job handover is verified'
);
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select is(
  public.request_job_correction(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    'Falta ajustar un detalle del acabado.'
  ),
  'CORRECTION_REQUESTED',
  'client correction returns the job to progress'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
  'IN_PROGRESS',
  'corrected job waits for a new submission'
);
select is(
  (select correction_count from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
  1,
  'correction round is counted'
);
update public.jobs set correction_count = 5
where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012');
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000002', true);
select ok(
  public.submit_job_delivery(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    'Segunda version para revision.'
  ) is not null,
  'third job delivery is resubmitted'
);
select ok(
  public.request_job_completion(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    (select confirmation_code from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012'))
  ) is not null,
  'third job handover is verified again'
);
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.request_job_correction(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
    'Otra vuelta mas.')$$,
  '22023', 'too many corrections; report a problem for mediation',
  'correction loop is capped'
);

-- Autocierre con evidencia: el tercer trabajo (enviado + verificado,
-- vencido) cierra; el cuarto (sin envio, vencido) no.
update public.jobs
set completion_requested_at = timezone('utc', now()) - interval '8 days',
    delivery_submitted_at = timezone('utc', now()) - interval '8 days'
where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012');
update public.jobs
set status = 'COMPLETION_REQUESTED',
    completion_requested_at = timezone('utc', now()) - interval '8 days',
    updated_at = timezone('utc', now()) - interval '8 days'
where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013');
select is(
  (select public.auto_complete_stale_jobs()),
  1,
  'cron closes exactly the evidenced stale job'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000012')),
  'COMPLETED',
  'evidenced stale job is auto-completed'
);
select is(
  (select status::text from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013')),
  'COMPLETION_REQUESTED',
  'unevidenced stale job stays open'
);
select ok(
  not exists (
    select 1 from public.job_events
    where job_id = (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013'))
      and event_type = 'JOB_AUTO_COMPLETED'
  ),
  'no auto-complete event without evidence'
);

-- Confirmacion manual sin evidencia: el trigger la frena.
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.transition_job_status(
    (select id from public.jobs where conversation_id = (select id from public.conversations where service_id = '17000000-0000-4000-8000-000000000013')),
    'COMPLETION_REQUESTED', 'COMPLETED', null, null)$$,
  '22023', 'delivery evidence is required before completion',
  'manual completion without evidence is rejected'
);
select * from finish();
rollback;
