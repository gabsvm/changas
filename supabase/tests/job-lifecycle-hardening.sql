begin;

select plan(70);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name = 'completion_requested_at' and is_nullable = 'YES'
  ),
  'jobs carry a nullable completion-requested clock'
);

select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'job_confirmation_code_attempts'
  ),
  'failed confirmation-code attempts are tracked'
);

select ok(
  not has_table_privilege('anon', 'public.job_confirmation_code_attempts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.job_confirmation_code_attempts', 'SELECT')
  and not has_table_privilege('service_role', 'public.job_confirmation_code_attempts', 'SELECT'),
  'code attempts are only writable by the transition function'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.request_job_completion(uuid,text)')))
  like '%insert into public.job_confirmation_code_attempts%',
  'a wrong confirmation code is recorded by the authority'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.request_job_completion(uuid,text)')))
  like '%return ''LOCKED''%',
  'repeated code failures lock out temporarily'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%completion_requested_at%',
  'the transition maintains the completion-requested clock'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.auto_complete_stale_jobs()')))
  like '%coalesce(completion_requested_at, updated_at)%',
  'auto-complete uses the dedicated clock with updated_at fallback'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%JOB_AUTO_COMPLETED%',
  'only auto-completed jobs can be disputed after completion'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%job can no longer be disputed%',
  'a stale or settled completion rejects late disputes'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals'
      and column_name = 'response_reason'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_scope_changes'
      and column_name = 'response_reason'
  ),
  'proposal and scope rejections carry an optional reason'
);

select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.respond_to_proposal(uuid,text,text)'))
  like '%response_reason%',
  'proposal responses accept a reason'
);

select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.respond_job_scope_change(uuid,text,text)'))
  like '%response_reason%',
  'scope-change responses accept a reason'
);

select ok(
  to_regprocedure('public.respond_to_proposal(uuid,text)') is not null
  and to_regprocedure('public.respond_job_scope_change(uuid,text)') is not null,
  'historic two-arg response signatures keep working'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.respond_to_proposal(uuid,text,text)')))
  like '%else p.response_reason%',
  'proposal response self-assigns the column qualified (no 42702)'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.respond_job_scope_change(uuid,text,text)')))
  like '%else sc.response_reason%',
  'scope-change response self-assigns the column qualified (no 42702)'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.respond_job_scope_change(uuid,text,text)')))
  like '%Cambio de alcance rechazado%',
  'scope rejections are announced in-thread'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_job_detail(uuid)')))
  like '%completion_requested_at%',
  'job detail exposes the completion-requested clock'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_job_detail(uuid)')))
  like '%caller_id = j.client_user_id then j.confirmation_code%',
  'job detail still restricts the confirmation code to the client'
);

-- Lote A+B (P1-01/P1-02/P1-05): fixtures sintéticos prefijo 1400…; todo hace
-- rollback al final del archivo.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '14000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'loteab-client@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"LoteAB Client"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '14000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'loteab-provider@example.test', 'not-a-real-password',
    now(), now(), now(), '{}', '{"display_name":"LoteAB Provider"}'
  );

insert into public.provider_profiles (
  user_id, status, onboarding_step, public_slug, public_headline
) values (
  '14000000-0000-4000-8000-000000000002',
  'ACTIVE',
  4,
  'loteab-provider',
  'Lote AB provider'
);

insert into public.provider_skills (provider_user_id, skill_id)
select
  '14000000-0000-4000-8000-000000000002',
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
  '14000000-0000-4000-8000-000000000010',
  '14000000-0000-4000-8000-000000000002',
  provider_skill.skill_id,
  'loteab-service',
  'Lote AB service',
  'Synthetic service used only by the Lote AB lifecycle pgTAP contract.',
  'REMOTE', 'FIXED', 100000, 'ARS', false, 'UNSCHEDULED', true
from public.provider_skills provider_skill
where provider_skill.provider_user_id = '14000000-0000-4000-8000-000000000002'
limit 1;

insert into public.conversations (
  id, service_id, client_user_id, provider_user_id, status
) values (
  '14000000-0000-4000-8000-000000000020',
  '14000000-0000-4000-8000-000000000010',
  '14000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000002',
  'OPEN'
);

insert into public.proposals (
  id, conversation_id, service_id, client_user_id, provider_user_id,
  kind, status, created_by_user_id
) values
  ('14000000-0000-4000-8000-000000000030', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'PROVIDER_QUOTE', 'ACCEPTED', '14000000-0000-4000-8000-000000000002'),
  ('14000000-0000-4000-8000-000000000031', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'PROVIDER_QUOTE', 'ACCEPTED', '14000000-0000-4000-8000-000000000002'),
  ('14000000-0000-4000-8000-000000000032', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'PROVIDER_QUOTE', 'ACCEPTED', '14000000-0000-4000-8000-000000000002'),
  ('14000000-0000-4000-8000-000000000033', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'PROVIDER_QUOTE', 'ACCEPTED', '14000000-0000-4000-8000-000000000002'),
  ('14000000-0000-4000-8000-000000000034', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'PROVIDER_QUOTE', 'ACCEPTED', '14000000-0000-4000-8000-000000000002'),
  ('14000000-0000-4000-8000-000000000035', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 'PROVIDER_QUOTE', 'ACCEPTED', '14000000-0000-4000-8000-000000000002');

insert into public.proposal_versions (
  id, proposal_id, version_number, kind, authored_by_user_id,
  service_title_snapshot, service_description_snapshot, modality,
  scope_snapshot, price_model_snapshot, price_amount, currency_code, schedule_type
) values
  ('14000000-0000-4000-8000-000000000040', '14000000-0000-4000-8000-000000000030', 1, 'PROVIDER_QUOTE', '14000000-0000-4000-8000-000000000002', 'Lote AB service', 'rate-limit job', 'REMOTE', 'rate-limit scope', 'FIXED', 50000, 'ARS', 'UNSCHEDULED'),
  ('14000000-0000-4000-8000-000000000041', '14000000-0000-4000-8000-000000000031', 1, 'PROVIDER_QUOTE', '14000000-0000-4000-8000-000000000002', 'Lote AB service', 'success-path job', 'IN_PERSON', 'success scope', 'FIXED', 60000, 'ARS', 'UNSCHEDULED'),
  ('14000000-0000-4000-8000-000000000042', '14000000-0000-4000-8000-000000000032', 1, 'PROVIDER_QUOTE', '14000000-0000-4000-8000-000000000002', 'Lote AB service', 'settlement job', 'REMOTE', 'settlement scope', 'FIXED', 100000, 'ARS', 'UNSCHEDULED'),
  ('14000000-0000-4000-8000-000000000043', '14000000-0000-4000-8000-000000000033', 1, 'PROVIDER_QUOTE', '14000000-0000-4000-8000-000000000002', 'Lote AB service', 'cancelled job', 'REMOTE', 'cancelled scope', 'FIXED', 70000, 'ARS', 'UNSCHEDULED'),
  ('14000000-0000-4000-8000-000000000044', '14000000-0000-4000-8000-000000000034', 1, 'PROVIDER_QUOTE', '14000000-0000-4000-8000-000000000002', 'Lote AB service', 'disputed job', 'REMOTE', 'disputed scope', 'FIXED', 80000, 'ARS', 'UNSCHEDULED'),
  ('14000000-0000-4000-8000-000000000045', '14000000-0000-4000-8000-000000000035', 1, 'PROVIDER_QUOTE', '14000000-0000-4000-8000-000000000002', 'Lote AB service', 'stale job', 'REMOTE', 'stale scope', 'FIXED', 90000, 'ARS', 'UNSCHEDULED');

update public.proposals
set current_version_id = case id
  when '14000000-0000-4000-8000-000000000030' then '14000000-0000-4000-8000-000000000040'::uuid
  when '14000000-0000-4000-8000-000000000031' then '14000000-0000-4000-8000-000000000041'::uuid
  when '14000000-0000-4000-8000-000000000032' then '14000000-0000-4000-8000-000000000042'::uuid
  when '14000000-0000-4000-8000-000000000033' then '14000000-0000-4000-8000-000000000043'::uuid
  when '14000000-0000-4000-8000-000000000034' then '14000000-0000-4000-8000-000000000044'::uuid
  else '14000000-0000-4000-8000-000000000045'::uuid
end,
accepted_version_id = case id
  when '14000000-0000-4000-8000-000000000030' then '14000000-0000-4000-8000-000000000040'::uuid
  when '14000000-0000-4000-8000-000000000031' then '14000000-0000-4000-8000-000000000041'::uuid
  when '14000000-0000-4000-8000-000000000032' then '14000000-0000-4000-8000-000000000042'::uuid
  when '14000000-0000-4000-8000-000000000033' then '14000000-0000-4000-8000-000000000043'::uuid
  when '14000000-0000-4000-8000-000000000034' then '14000000-0000-4000-8000-000000000044'::uuid
  else '14000000-0000-4000-8000-000000000045'::uuid
end
where id in (
  '14000000-0000-4000-8000-000000000030', '14000000-0000-4000-8000-000000000031',
  '14000000-0000-4000-8000-000000000032', '14000000-0000-4000-8000-000000000033',
  '14000000-0000-4000-8000-000000000034', '14000000-0000-4000-8000-000000000035'
);

insert into public.jobs (
  id, conversation_id, service_id, client_user_id, provider_user_id,
  accepted_proposal_version_id, status, confirmation_code,
  completion_requested_at, delivery_submitted_at, updated_at
) values
  ('14000000-0000-4000-8000-000000000101', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000040', 'IN_PROGRESS', '1234', null, null, timezone('utc', now())),
  ('14000000-0000-4000-8000-000000000102', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000041', 'IN_PROGRESS', '5678', null, timezone('utc', now()), timezone('utc', now())),
  ('14000000-0000-4000-8000-000000000103', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000042', 'COMPLETED', '9999', null, null, timezone('utc', now())),
  ('14000000-0000-4000-8000-000000000104', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000043', 'CANCELLED', '1111', timezone('utc', now()) - interval '8 days', null, timezone('utc', now()) - interval '8 days'),
  ('14000000-0000-4000-8000-000000000105', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000044', 'DISPUTED', '2222', timezone('utc', now()) - interval '8 days', null, timezone('utc', now()) - interval '8 days'),
  ('14000000-0000-4000-8000-000000000106', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000045', 'COMPLETION_REQUESTED', '3333', timezone('utc', now()) - interval '8 days', timezone('utc', now()) - interval '8 days', timezone('utc', now()));

insert into public.job_scope_changes (
  id, job_id, requested_by_user_id, status, scope_snapshot,
  additional_amount_minor, currency_code
) values (
  '14000000-0000-4000-8000-000000000080',
  '14000000-0000-4000-8000-000000000103',
  '14000000-0000-4000-8000-000000000002',
  'AWAITING_PAYMENT',
  'Lote AB extra scope',
  20000, 'ARS'
);

-- P1-01: el rate-limit persiste (5 fallos + 6to bloqueado). Corre como el
-- proveedor, que es quien adivina el código.
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '0000'),
  'MISMATCH',
  'confirmation failure 1 of 5 is recorded'
);
select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '0000'),
  'MISMATCH',
  'confirmation failure 2 of 5 is recorded'
);
select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '0000'),
  'MISMATCH',
  'confirmation failure 3 of 5 is recorded'
);
select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '0000'),
  'MISMATCH',
  'confirmation failure 4 of 5 is recorded'
);
select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '0000'),
  'MISMATCH',
  'confirmation failure 5 of 5 is recorded'
);
select is(
  (select count(*)::integer from public.job_confirmation_code_attempts where job_id = '14000000-0000-4000-8000-000000000101'),
  5,
  'five code failures persist instead of rolling back'
);
select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '0000'),
  'LOCKED',
  'the sixth attempt is blocked by the rate-limit'
);
select is(
  public.record_confirmation_code_attempt('14000000-0000-4000-8000-000000000101', '1234'),
  'LOCKED',
  'the correct code stays locked until the window passes'
);
-- YALO A1: la ruta vieja ya no cierra con código (bypass cerrado).
select throws_ok(
  $$select public.transition_job_status('14000000-0000-4000-8000-000000000101', 'IN_PROGRESS'::public.job_status, 'COMPLETION_REQUESTED'::public.job_status, null, '1234')$$,
  '22023', 'request completion through request_job_completion',
  'direct completion through the transition is rejected even with the right code'
);
-- Fixtures A1: ...107 para fallos/lock vía autoridad, ...108 no se usa
-- (confirmation_code es NOT NULL desde 20261012000000).
insert into public.jobs (
  id, conversation_id, service_id, client_user_id, provider_user_id,
  accepted_proposal_version_id, status, confirmation_code,
  completion_requested_at, delivery_submitted_at, updated_at
) values (
  '14000000-0000-4000-8000-000000000107', '14000000-0000-4000-8000-000000000020', '14000000-0000-4000-8000-000000000010', '14000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000040', 'IN_PROGRESS', '4321', null, timezone('utc', now()), timezone('utc', now())
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '0000'),
  'MISMATCH',
  'authority failure 1 of 5 is recorded'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '0000'),
  'MISMATCH',
  'authority failure 2 of 5 is recorded'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '0000'),
  'MISMATCH',
  'authority failure 3 of 5 is recorded'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '0000'),
  'MISMATCH',
  'authority failure 4 of 5 is recorded'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '0000'),
  'MISMATCH',
  'authority failure 5 of 5 is recorded'
);
select is(
  (select count(*)::integer from public.job_confirmation_code_attempts where job_id = '14000000-0000-4000-8000-000000000107'),
  5,
  'five authority failures persist without rollback'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '0000'),
  'LOCKED',
  'the sixth authority attempt is blocked'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000107', '4321'),
  'LOCKED',
  'the correct code stays locked through the authority too'
);
select is(
  public.request_job_completion('14000000-0000-4000-8000-000000000102', '5678'),
  'COMPLETED',
  'the correct code completes through the authority'
);
select is(
  (select status::text from public.jobs where id = '14000000-0000-4000-8000-000000000102'),
  'COMPLETION_REQUESTED',
  'authority success flips the job status'
);
select is(
  (select count(*)::integer from public.job_confirmation_code_attempts where job_id = '14000000-0000-4000-8000-000000000102'),
  0,
  'authority success clears prior attempts'
);
select is(
  (select count(*)::integer from public.job_events where job_id = '14000000-0000-4000-8000-000000000102' and event_type = 'JOB_HANDOVER_VERIFIED' and to_status = 'COMPLETION_REQUESTED'),
  1,
  'authority success records exactly one transition event'
);
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000099', true);
select throws_ok(
  $$select public.request_job_completion('14000000-0000-4000-8000-000000000102', '5678')$$,
  '42501', null,
  'an outsider cannot request completion'
);
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.request_job_completion('14000000-0000-4000-8000-000000000103', '9999')$$,
  '40001', null,
  'completion outside IN_PROGRESS is rejected'
);

-- P1-01 a nivel definición: sin INSERT+RAISE autodestructivo, con lock.
select has_function(
  'public',
  'record_confirmation_code_attempt',
  array['uuid', 'text'],
  'the code-attempt recorder RPC exists'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.record_confirmation_code_attempt(uuid,text)'),
      'EXECUTE'
    ),
    false
  )
  and not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.record_confirmation_code_attempt(uuid,text)'),
      'EXECUTE'
    ),
    false
  ),
  'the recorder is callable by participants, not anonymously'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  not like '%insert into public.job_confirmation_code_attempts%',
  'the transition no longer inserts attempts before raising'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%request completion through request_job_completion%',
  'the old completion route rejects instead of guessing codes'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.request_job_completion(uuid,text)')))
  like '%pg_advisory_xact_lock%',
  'the authority serializes code guesses per job'
);
select has_function(
  'public',
  'request_job_completion',
  array['uuid', 'text'],
  'the completion authority RPC exists'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.request_job_completion(uuid,text)'),
      'EXECUTE'
    ),
    false
  )
  and not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.request_job_completion(uuid,text)'),
      'EXECUTE'
    ),
    false
  ),
  'the authority is callable by participants, not anonymously'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.record_confirmation_code_attempt(uuid,text)')))
  like '%pg_advisory_xact_lock%',
  'the recorder serializes code guesses per job'
);

-- P1-02: el cron es atómico y no pisa CANCELLED/DISPUTED.
select ok(
  (select pg_get_functiondef(to_regprocedure('public.auto_complete_stale_jobs()')))
  like '%for update skip locked%',
  'auto-complete claims rows with SKIP LOCKED'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.auto_complete_stale_jobs()')))
  like '%and status = ''COMPLETION_REQUESTED''%',
  'auto-complete revalidates status under the row lock'
);
select is(
  (select public.auto_complete_stale_jobs()),
  1,
  'the cron completes exactly the one stale requested job'
);
select is(
  (select status::text from public.jobs where id = '14000000-0000-4000-8000-000000000106'),
  'COMPLETED',
  'a stale completion request is auto-completed'
);
select ok(
  exists (
    select 1 from public.job_events
    where job_id = '14000000-0000-4000-8000-000000000106'
      and event_type = 'JOB_AUTO_COMPLETED'
  ),
  'auto-completion records its event'
);
select is(
  (select status::text from public.jobs where id = '14000000-0000-4000-8000-000000000104'),
  'CANCELLED',
  'the cron never overwrites a stale CANCELLED job'
);
select is(
  (select status::text from public.jobs where id = '14000000-0000-4000-8000-000000000105'),
  'DISPUTED',
  'the cron never overwrites a stale DISPUTED job'
);
select ok(
  not exists (
    select 1 from public.job_events
    where job_id in (
      '14000000-0000-4000-8000-000000000104',
      '14000000-0000-4000-8000-000000000105'
    )
      and event_type = 'JOB_AUTO_COMPLETED'
  ),
  'no auto-complete event exists for CANCELLED or DISPUTED jobs'
);

-- P1-05: settled inmutable con extras, due dinámico, snapshot intacto.
select has_function(
  'public',
  'settled_amount_for_job',
  array['uuid'],
  'the immutable settled-amount helper exists'
);
select has_function(
  'public',
  'amount_due_for_job',
  array['uuid'],
  'the dynamic amount-due helper exists'
);
select is(
  public.amount_due_for_job('14000000-0000-4000-8000-000000000103'),
  120000::bigint,
  'amount due is dynamic before settlement (base plus unpaid extras)'
);
select is(
  public.settled_amount_for_job('14000000-0000-4000-8000-000000000103'),
  null::bigint,
  'nothing is settled before the provider result lands'
);
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select * from public.apply_job_settlement_result('14000000-0000-4000-8000-000000000103', '14000000-0000-4000-8000-000000000090', 'MERCADO_PAGO', 'settle-ref-140001', 'SUCCEEDED', '14000000-0000-4000-8000-000000000001', array['14000000-0000-4000-8000-000000000080'::uuid], 120000)$$,
  'settling base plus extras succeeds'
);
select is(
  public.settled_amount_for_job('14000000-0000-4000-8000-000000000103'),
  120000::bigint,
  'the settled amount is immutable and includes the extras'
);
select is(
  public.amount_due_for_job('14000000-0000-4000-8000-000000000103'),
  0::bigint,
  'nothing is due after settlement'
);
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select settlement_status from public.get_job_detail('14000000-0000-4000-8000-000000000103')),
  'SETTLED',
  'job detail reports the settled status'
);
select is(
  (select settled_amount_minor from public.get_job_detail('14000000-0000-4000-8000-000000000103')),
  120000::bigint,
  'job detail exposes the immutable settled amount with extras'
);
select has_function(
  'public',
  'get_job_settlement_snapshot',
  array['uuid'],
  'settlement snapshot RPC keeps its signature'
);
select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_job_settlement_snapshot(uuid)')))
  not like '%settled_amount_for_job%',
  'settlement snapshot logic is untouched'
);
-- YALO A3: sin cobro online no se materializan recordatorios de deuda.
select is(
  (select enabled from public.app_feature_flags where name = 'payments_online'),
  false,
  'online payments ship disabled by default'
);
select is(
  (select public.materialize_due_settlement_reminders()),
  0,
  'no debt reminders materialize while payments are off'
);


select * from finish();
rollback;
