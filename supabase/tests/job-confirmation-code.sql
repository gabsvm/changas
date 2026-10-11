begin;

select plan(10);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name = 'confirmation_code' and is_nullable = 'NO'
  ),
  'jobs carry a mandatory confirmation code'
);

select ok(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'jobs'
     and column_name = 'confirmation_code')
  like '%random()%',
  'confirmation code defaults to a random value'
);

select ok(
  not has_column_privilege('anon', 'public.jobs', 'confirmation_code', 'SELECT')
  and not has_column_privilege('authenticated', 'public.jobs', 'confirmation_code', 'SELECT'),
  'confirmation code is not readable over direct REST'
);

select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)'))
  like '%confirmation_code%',
  'job transition accepts a confirmation code'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text,text)')))
  like '%confirmation code is required to request completion%',
  'requesting completion without the code is rejected'
);

select ok(
  (select proargnames::text from pg_proc
   where oid = to_regprocedure('public.get_job_detail(uuid)'))
  like '%confirmation_code%',
  'job detail exposes the confirmation code'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.get_job_detail(uuid)')))
  like '%caller_id = j.client_user_id then j.confirmation_code%',
  'confirmation code is only exposed to the client'
);

select ok(
  to_regprocedure('public.notify_settlement_review_nudge()') is not null,
  'settlement review nudge function exists'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'settlement_review_nudge' and not tgisinternal),
  'settlement success enqueues a review nudge'
);

select ok(
  exists (
    select 1 from cron.job where jobname = 'job-reminders-24h'
  ),
  'upcoming-job reminders are scheduled'
);

select * from finish();
rollback;
