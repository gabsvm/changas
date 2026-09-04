begin;

select plan(5);

select ok(
  to_regprocedure('public.list_admin_catalog_categories()') is not null,
  'list_admin_catalog_categories exists'
);

select ok(
  to_regprocedure('public.list_admin_catalog_skills(uuid)') is not null,
  'list_admin_catalog_skills exists'
);

select ok(
  to_regprocedure('public.list_admin_services(text,integer,integer)') is not null,
  'list_admin_services exists'
);

select ok(
  coalesce((
    select bool_and(
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_admin_catalog_categories',
        'list_admin_catalog_skills',
        'list_admin_services'
      )
    having count(*) = 3
  ), false),
  'catalog read-model RPCs are authenticated-only entrypoints'
);

select ok(
  coalesce((
    select bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE'))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_admin_catalog_categories',
        'list_admin_catalog_skills',
        'list_admin_services'
      )
    having count(*) = 3
  ), false),
  'trusted runtime can execute catalog read-model RPCs'
);

select * from finish();
rollback;
