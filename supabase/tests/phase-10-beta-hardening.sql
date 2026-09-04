begin;

select plan(14);

select ok(
  coalesce((
    select bool_and(c.relrowsecurity) and count(*) = 23
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'profiles','profile_private','provider_profiles','provider_documents','user_roles',
        'provider_skills','services','service_areas','conversations','conversation_participants',
        'messages','message_attachments','proposals','proposal_versions','proposal_events',
        'payment_attempts','jobs','reviews','review_reports','admin_audit_events',
        'account_restrictions','job_scope_changes','job_additional_payment_attempts'
      ])
  ), false),
  'all Phase 10 high-risk public tables exist with RLS enabled'
);

select ok(
  coalesce((select not public from storage.buckets where id = 'identity-documents'), false),
  'identity documents bucket remains private'
);

select ok(
  coalesce((select not public from storage.buckets where id = 'conversation-attachments'), false),
  'conversation attachments bucket remains private'
);

select ok(
  (select count(*) = 4
   from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname in (
       'identity_documents_select_own','identity_documents_insert_own',
       'identity_documents_update_own','identity_documents_delete_own'
     )),
  'identity storage keeps owner-only CRUD policies'
);

select ok(
  (select count(*) = 4
   from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname in (
       'conversation_attachments_select_participant','conversation_attachments_insert_participant',
       'conversation_attachments_update_participant','conversation_attachments_delete_participant'
     )),
  'conversation storage keeps participant-only CRUD policies'
);

select ok(
  not has_table_privilege('anon', 'public.provider_documents', 'SELECT')
  and not has_table_privilege('anon', 'public.message_attachments', 'SELECT')
  and not has_table_privilege('anon', 'public.admin_audit_events', 'SELECT'),
  'anonymous callers have no direct access to private evidence or audit tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.admin_audit_events', 'SELECT, INSERT, UPDATE, DELETE'),
  'browser sessions cannot promote roles or bypass the admin audit RPC boundary'
);

select ok(
  coalesce((
    select bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE'))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'apply_fake_payment_result','apply_fake_additional_payment_result',
        'decide_provider_identity_review','get_admin_identity_case',
        'admin_set_account_restriction','admin_restore_account','list_admin_audit_events'
      )
    having count(*) >= 7
  ), false),
  'anonymous callers cannot execute privileged payment, identity or admin entrypoints'
);

select ok(
  coalesce((
    select bool_and(
      exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) config
        where config like 'search_path=%'
      )
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'apply_fake_payment_result','apply_fake_additional_payment_result',
        'decide_provider_identity_review','get_admin_identity_case',
        'admin_set_account_restriction','admin_restore_account'
      )
    having count(*) >= 6
  ), false),
  'privileged SECURITY DEFINER entrypoints pin search_path'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_attempts'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%proposal_id%request_nonce%'
  ),
  'initial fake-payment requests are idempotent per proposal and nonce'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'job_additional_payment_attempts'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%scope_change_id%request_nonce%'
  ),
  'additional fake-payment requests are idempotent per scope change and nonce'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'provider_booking_slots'
      and c.contype = 'x'
  ),
  'provider booking slots keep a database exclusion constraint for provider schedule overlap'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'proposal_versions'
      and t.tgname = 'proposal_versions_immutable_guard'
      and not t.tgisinternal
  ),
  'accepted proposal history remains immutable'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'reviews'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%job_id%'
  ),
  'verified reviews remain unique per completed Job'
);

select * from finish();
rollback;
