begin;

select plan(18);

select ok(to_regclass('public.reviews') is not null, 'verified reviews table exists');
select ok(to_regclass('public.review_replies') is not null, 'provider review replies table exists');
select ok(to_regclass('public.review_reports') is not null, 'private review reports table exists');
select ok(to_regtype('public.review_report_reason') is not null, 'review report reason enum exists');

select ok(
  coalesce((
    select array_agg(e.enumlabel order by e.enumsortorder)::text[] @>
      array['THREATS','INSULTS','PRIVATE_INFORMATION','DISCRIMINATION','IRRELEVANT_CONTENT','EXTORTION','ABUSE','OTHER']::text[]
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'review_report_reason'
  ), false),
  'review report reasons cover the Phase 07 reporting taxonomy'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_job_review'
  ),
  'create_job_review rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_provider_review_reply'
  ),
  'provider review reply rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'report_review'
  ),
  'review reporting rpc exists'
);

select ok(
  coalesce((
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('reviews', 'review_replies', 'review_reports')
    having count(*) = 3
  ), false),
  'all Phase 07 review tables keep RLS enabled'
);

select ok(
  coalesce((
    select
      has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reviews'
  ), false),
  'authenticated review access is read-only at the table boundary'
);

select ok(
  coalesce((
    select
      not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'review_replies'
  ), false),
  'provider replies are mutated through RPC authority only'
);

select ok(
  coalesce((
    select
      not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'review_reports'
  ), false),
  'review reports are private and RPC-mutated only'
);

select ok(
  coalesce((
    select
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_job_review'
    limit 1
  ), false),
  'review creation is authenticated-only'
);

select ok(
  coalesce((
    select
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_provider_review_reply'
    limit 1
  ), false),
  'review reply mutation is authenticated-only'
);

select ok(
  coalesce((
    select
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'report_review'
    limit 1
  ), false),
  'review reporting is authenticated-only'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'reviews_job_id_key'
  ),
  'one public client review is allowed per completed Job'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'review_replies_review_id_key'
  ),
  'a provider has at most one public reply per review'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'reviews_immutable_guard' and not tgisinternal
  ),
  'published client reviews are immutable'
);

select * from finish();
rollback;
