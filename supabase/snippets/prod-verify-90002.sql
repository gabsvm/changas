-- Verify 20261013090002 en prod: replica el assert phase-09 #12.
select coalesce((
  select bool_and(
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
  )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'list_admin_identity_queue',
      'get_admin_identity_case',
      'decide_provider_identity_review'
    )
  having count(*) = 3
), false) as identity_entrypoints_ok;
