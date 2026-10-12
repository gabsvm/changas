-- Verify 20261013080000 en prod: todo debe ser 1 / true.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'jobs' and column_name = 'completion_requested_at') as jobs_clock,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'proposals' and column_name = 'response_reason') as prop_reason,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'job_scope_changes' and column_name = 'response_reason') as scope_reason,
  (select to_regprocedure('public.respond_to_proposal(uuid,text,text)') is not null) as prop3,
  (select to_regprocedure('public.respond_to_proposal(uuid,text)') is not null) as prop2,
  (select to_regprocedure('public.respond_job_scope_change(uuid,text,text)') is not null) as scope3,
  (select to_regprocedure('public.respond_job_scope_change(uuid,text)') is not null) as scope2,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'job_confirmation_code_attempts') as attempts;
