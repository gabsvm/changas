begin;

select plan(24);

select ok(to_regclass('public.moderation_cases') is not null, 'moderation cases table exists');
select ok(to_regclass('public.account_restrictions') is not null, 'account restrictions table exists');
select ok(to_regclass('public.review_moderation_state') is not null, 'review moderation state table exists');
select ok(to_regclass('public.message_moderation_state') is not null, 'message moderation state table exists');

select ok(
  coalesce((
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('moderation_cases','account_restrictions','review_moderation_state','message_moderation_state')
    having count(*) = 4
  ), false),
  'trust and safety state tables keep RLS enabled'
);

select ok(
  coalesce((
    select bool_and(
      not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    )
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('moderation_cases','account_restrictions','review_moderation_state','message_moderation_state')
    having count(*) = 4
  ), false),
  'browser roles cannot bypass trust and safety RPCs'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'account_restrictions_one_active_idx'
      and indexdef like '%WHERE (revoked_at IS NULL)%'
  ),
  'only one active restriction is allowed per account'
);

select ok(
  coalesce((
    select bool_or(
      pg_get_constraintdef(c.oid) like '%RESTRICTED%'
      and pg_get_constraintdef(c.oid) like '%SUSPENDED%'
    )
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'account_restrictions' and c.contype = 'c'
  ), false),
  'restriction kinds are constrained'
);

select ok(
  coalesce((
    select bool_or(
      pg_get_constraintdef(c.oid) like '%VISIBLE%'
      and pg_get_constraintdef(c.oid) like '%HIDDEN_POLICY%'
      and pg_get_constraintdef(c.oid) like '%RESTORED%'
    )
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'review_moderation_state' and c.contype = 'c'
  ), false),
  'review dispositions are constrained and reversible'
);

select ok(
  coalesce((
    select bool_or(
      pg_get_constraintdef(c.oid) like '%VISIBLE%'
      and pg_get_constraintdef(c.oid) like '%HIDDEN_POLICY%'
      and pg_get_constraintdef(c.oid) like '%RESTORED%'
    )
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'message_moderation_state' and c.contype = 'c'
  ), false),
  'message dispositions are constrained and reversible'
);

select ok(to_regprocedure('public.list_admin_reports(text,integer,integer)') is not null, 'admin report queue RPC exists');
select ok(to_regprocedure('public.admin_resolve_report(text,uuid,text)') is not null, 'admin report resolution RPC exists');
select ok(to_regprocedure('public.admin_set_account_restriction(uuid,text,text)') is not null, 'admin restriction RPC exists');
select ok(to_regprocedure('public.admin_restore_account(uuid,text)') is not null, 'admin restore RPC exists');
select ok(to_regprocedure('public.admin_set_review_moderation(uuid,text,text)') is not null, 'admin review moderation RPC exists');
select ok(to_regprocedure('public.admin_set_message_moderation(uuid,text,text)') is not null, 'admin message moderation RPC exists');
select ok(to_regprocedure('public.list_admin_catalog_categories()') is not null, 'admin category read RPC exists');
select ok(to_regprocedure('public.list_admin_catalog_skills(uuid)') is not null, 'admin skill read RPC exists');
select ok(to_regprocedure('public.list_admin_services(text,integer,integer)') is not null, 'admin service read RPC exists');

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
        'list_admin_reports','admin_resolve_report','admin_set_account_restriction',
        'admin_restore_account','admin_set_review_moderation','admin_set_message_moderation',
        'list_admin_catalog_categories','list_admin_catalog_skills','list_admin_services'
      )
    having count(*) = 9
  ), false),
  'trust and safety admin entrypoints are authenticated-only'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reviews'
      and t.tgname = 'reviews_immutable_guard' and not t.tgisinternal
  ),
  'published review immutability remains enforced'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'conversation_reports'
      and policyname = 'conversation_reports_select_owner'
  ),
  'conversation reports are hardened to reporter-only reads'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'messages'
      and t.tgname = 'messages_account_restriction_guard'
      and not t.tgisinternal
  ),
  'restricted accounts are blocked at a transactional write boundary'
);

select ok(
  pg_get_functiondef('public.provider_reputation_metrics_internal(uuid,uuid,uuid)'::regprocedure)
    like '%is_review_publicly_visible%'
  and pg_get_functiondef('public.list_public_provider_reviews(text,text,text,timestamptz,uuid,integer)'::regprocedure)
    like '%is_review_publicly_visible%',
  'hidden reviews are removed from public review reads and reputation metrics'
);

select * from finish();
rollback;
