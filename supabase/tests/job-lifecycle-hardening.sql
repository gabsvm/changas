begin;

select plan(16);

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
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%confirmation code does not match%',
  'a wrong confirmation code is rejected distinctly'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%confirmation code locked%',
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

select * from finish();
rollback;
