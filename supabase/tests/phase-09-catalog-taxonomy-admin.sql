begin;

select plan(11);

select ok(
  to_regprocedure('public.list_admin_skill_synonyms(uuid)') is not null,
  'admin synonym read RPC exists'
);

select ok(
  to_regprocedure('public.list_admin_service_tags(uuid)') is not null,
  'admin service tag read RPC exists'
);

select ok(
  to_regprocedure('public.admin_create_service_tag(uuid,text)') is not null,
  'admin create service tag RPC exists'
);

select ok(
  to_regprocedure('public.admin_update_service_tag(uuid,text,text)') is not null,
  'admin update service tag RPC exists'
);

select ok(
  to_regprocedure('public.admin_delete_service_tag(uuid,text)') is not null,
  'admin delete service tag RPC exists'
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
        'list_admin_skill_synonyms',
        'list_admin_service_tags',
        'admin_create_service_tag',
        'admin_update_service_tag',
        'admin_delete_service_tag'
      )
    having count(*) = 5
  ), false),
  'taxonomy admin RPC entrypoints are authenticated-only'
);

select ok(
  pg_get_functiondef('public.list_admin_skill_synonyms(uuid)'::regprocedure)
    like '%require_admin%',
  'admin synonym reads enforce the real admin role'
);

select ok(
  pg_get_functiondef('public.list_admin_service_tags(uuid)'::regprocedure)
    like '%require_admin%',
  'admin tag reads enforce the real admin role'
);

select ok(
  pg_get_functiondef('public.admin_create_service_tag(uuid,text)'::regprocedure)
    like '%CATALOG_TAG_CREATED%',
  'tag creation is audited'
);

select ok(
  pg_get_functiondef('public.admin_update_service_tag(uuid,text,text)'::regprocedure)
    like '%CATALOG_TAG_UPDATED%',
  'tag updates are audited'
);

select ok(
  pg_get_functiondef('public.admin_delete_service_tag(uuid,text)'::regprocedure)
    like '%CATALOG_TAG_DELETED%',
  'tag deletion is audited'
);

select * from finish();
rollback;
