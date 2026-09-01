begin;

select plan(19);

select ok(to_regclass('public.proposals') is not null, 'proposals table exists');
select ok(to_regclass('public.proposal_versions') is not null, 'proposal versions table exists');
select ok(to_regclass('public.payment_attempts') is not null, 'payment attempts table exists');
select ok(to_regclass('public.jobs') is not null, 'jobs table exists');
select ok(to_regclass('public.proposal_events') is not null, 'proposal audit events table exists');

select ok(
  exists (select 1 from pg_type where typname = 'proposal_kind'),
  'proposal kind enum exists'
);
select ok(
  exists (select 1 from pg_type where typname = 'proposal_status'),
  'proposal status enum exists'
);
select ok(
  exists (select 1 from pg_type where typname = 'payment_status'),
  'payment status enum exists'
);
select ok(
  exists (select 1 from pg_type where typname = 'job_status'),
  'job status enum exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_conversation_proposal'
  ),
  'create proposal rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'revise_conversation_proposal'
  ),
  'revise proposal rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'respond_to_proposal'
  ),
  'proposal response rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_fake_payment_result'
  ),
  'fake payment transition rpc exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.proposals'::regclass),
  'proposals keep RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.proposal_versions'::regclass),
  'proposal versions keep RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.proposals', 'SELECT')
  and not has_table_privilege('authenticated', 'public.proposals', 'INSERT, UPDATE, DELETE'),
  'authenticated proposal table access is read-only'
);
select ok(
  has_table_privilege('authenticated', 'public.proposal_versions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.proposal_versions', 'INSERT, UPDATE, DELETE'),
  'authenticated proposal version access is read-only'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'accepted_proposal_version_id'
  ),
  'job references immutable accepted proposal version'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'proposal_versions_immutable_guard'
      and not tgisinternal
  ),
  'accepted proposal versions are guarded against mutation'
);

select * from finish();
rollback;
