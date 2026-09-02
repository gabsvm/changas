begin;

select plan(6);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_rehire_proposal'
  ),
  'create_rehire_proposal rpc exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_job_review_state'
  ),
  'get_job_review_state rpc exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_my_favorite_providers_v2'
  ),
  'reputation-aware favorite provider rpc exists'
);

select ok(
  coalesce((
    select
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_rehire_proposal'
    limit 1
  ), false),
  'rehire creation is authenticated-only'
);

select ok(
  coalesce((
    select
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_job_review_state'
    limit 1
  ), false),
  'job review state is authenticated-only'
);

select ok(
  coalesce((
    select
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_my_favorite_providers_v2'
    limit 1
  ), false),
  'reputation-aware favorites are authenticated-only'
);

select * from finish();
rollback;
