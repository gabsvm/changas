begin;

select plan(24);

select ok(to_regclass('public.job_events') is not null, 'job events table exists');
select ok(to_regclass('public.job_schedule_versions') is not null, 'job schedule versions table exists');
select ok(to_regclass('public.provider_booking_slots') is not null, 'provider booking slots table exists');
select ok(to_regclass('public.job_reschedule_requests') is not null, 'reschedule requests table exists');
select ok(to_regclass('public.job_scope_changes') is not null, 'scope changes table exists');
select ok(to_regclass('public.job_additional_payment_attempts') is not null, 'additional payment attempts table exists');
select ok(to_regclass('public.job_private_locations') is not null, 'private job locations table exists');

select ok(
  (select array_agg(e.enumlabel order by e.enumsortorder)::text[]
   from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'job_status')
  @> array['CONFIRMED','IN_PROGRESS','COMPLETION_REQUESTED','COMPLETED','CANCELLED','DISPUTED','NO_SHOW']::text[],
  'job status enum contains executable lifecycle states'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'provider_booking_slots_provider_user_id_tstzrange_excl'),
  'provider booking slots use an exclusion constraint to prevent overlap'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'job_events_immutable_guard' and not tgisinternal),
  'job event history is immutable'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'job_schedule_versions_immutable_guard' and not tgisinternal),
  'schedule version history is immutable'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'jobs_initialize_schedule' and not tgisinternal),
  'new confirmed jobs initialize a schedule snapshot'
);

select ok(to_regprocedure('public.transition_job_status(uuid,public.job_status,public.job_status,text)') is not null, 'job transition rpc exists');
select ok(to_regprocedure('public.request_job_reschedule(uuid,public.schedule_type,timestamp with time zone,timestamp with time zone,timestamp with time zone,integer,text)') is not null, 'reschedule request rpc exists');
select ok(to_regprocedure('public.respond_job_reschedule(uuid,text)') is not null, 'reschedule response rpc exists');
select ok(to_regprocedure('public.request_job_scope_change(uuid,text,bigint)') is not null, 'scope change request rpc exists');
select ok(to_regprocedure('public.respond_job_scope_change(uuid,text)') is not null, 'scope change response rpc exists');
select ok(to_regprocedure('public.apply_fake_additional_payment_result(uuid,uuid,text,uuid)') is not null, 'fake additional payment rpc exists');
select ok(to_regprocedure('public.set_job_exact_location(uuid,text,double precision,double precision,text)') is not null, 'private exact location rpc exists');
select ok(to_regprocedure('public.get_job_detail(uuid)') is not null, 'job detail read model exists');
select ok(to_regprocedure('public.list_my_upcoming_jobs(integer)') is not null, 'upcoming work read model exists');

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.job_events'::regclass,
     'public.job_schedule_versions'::regclass,
     'public.job_reschedule_requests'::regclass,
     'public.job_scope_changes'::regclass,
     'public.job_private_locations'::regclass
   )),
  'Phase 06 contractual tables keep RLS enabled'
);

select ok(
  has_table_privilege('authenticated', 'public.job_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.job_events', 'INSERT, UPDATE, DELETE')
  and has_table_privilege('authenticated', 'public.job_schedule_versions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.job_schedule_versions', 'INSERT, UPDATE, DELETE'),
  'authenticated contractual history access is read-only'
);

select ok(
  not has_function_privilege('anon', 'public.transition_job_status(uuid,public.job_status,public.job_status,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.transition_job_status(uuid,public.job_status,public.job_status,text)', 'EXECUTE'),
  'job transition execution is authenticated-only'
);

select * from finish();
rollback;
