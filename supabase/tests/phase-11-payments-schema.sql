begin;

select plan(25);

select has_table('public', 'payment_provider_accounts', 'payment provider accounts table exists');
select has_table('public', 'payment_checkout_sessions', 'payment checkout sessions table exists');
select has_table('public', 'payment_provider_events', 'payment provider events table exists');
select has_table('public', 'financial_ledger_entries', 'financial ledger entries table exists');

select ok(
  (select count(*) = 6
   from pg_type t
   join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
     and t.typtype = 'e'
     and t.typname in (
       'payment_provider_account_status',
       'payment_checkout_purpose',
       'payment_checkout_status',
       'payment_provider_event_processing_status',
       'financial_ledger_entry_type',
       'financial_ledger_party_type'
     )),
  'Phase 11 payment enums exist'
);

select ok(
  coalesce((
    select count(*) = 4 and bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'payment_provider_accounts',
        'payment_checkout_sessions',
        'payment_provider_events',
        'financial_ledger_entries'
      )
  ), false),
  'all Phase 11 financial tables have RLS enabled'
);

select ok(
  (select count(*) = 7
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'payment_provider_accounts'
     and column_name in (
       'access_token_ciphertext',
       'access_token_iv',
       'access_token_auth_tag',
       'refresh_token_ciphertext',
       'refresh_token_iv',
       'refresh_token_auth_tag',
       'encryption_key_version'
     )),
  'seller access and refresh tokens use separate authenticated encryption envelopes'
);

select ok(
  not exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'payment_provider_accounts'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
      and column_name in (
        'access_token_ciphertext',
        'access_token_iv',
        'access_token_auth_tag',
        'refresh_token_ciphertext',
        'refresh_token_iv',
        'refresh_token_auth_tag',
        'encryption_key_version'
      )
  ),
  'authenticated users cannot directly read encrypted seller token material'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'payment_provider_accounts',
        'payment_checkout_sessions',
        'payment_provider_events',
        'financial_ledger_entries'
      )
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'authenticated users cannot mutate Phase 11 financial tables directly'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'payment_provider_accounts',
        'payment_checkout_sessions',
        'payment_provider_events',
        'financial_ledger_entries'
      )
      and grantee = 'anon'
  ),
  'anonymous users have no direct access to Phase 11 financial tables'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'financial_ledger_entries'
      and grantee in ('authenticated', 'service_role')
      and privilege_type in ('UPDATE', 'DELETE')
  ),
  'ledger rows are not updateable or deletable through exposed roles'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_provider_events'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%provider_name%provider_event_key%'
  ),
  'provider event delivery is unique per provider and event key'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'financial_ledger_entries'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%idempotency_key%'
  ),
  'financial ledger effects are unique by deterministic idempotency key'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_ledger_entries'
      and t.tgname = 'financial_ledger_entries_immutable_guard'
      and not t.tgisinternal
  ),
  'financial ledger rows have an immutable update/delete guard'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_payment_provider_account_state'
  ),
  'provider-safe payment account state reader exists'
);

select ok(
  coalesce((
    select bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_payment_provider_account_state'
  ), false),
  'authenticated providers can execute the safe payment account state reader'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'upsert_payment_provider_account'
  ),
  'server-only sensitive payment account writer exists'
);

select ok(
  coalesce((
    select bool_and(
      has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'upsert_payment_provider_account'
    having count(*) >= 1
  ), false),
  'sensitive payment account writer is service-role only'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_payment_provider_event'
  ),
  'server-only provider event writer exists'
);

select ok(
  coalesce((
    select bool_and(
      has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_payment_provider_event'
    having count(*) >= 1
  ), false),
  'provider event writer is service-role only'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'append_financial_ledger_entry'
  ),
  'server-only ledger append function exists'
);

select ok(
  coalesce((
    select bool_and(
      has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'append_financial_ledger_entry'
    having count(*) >= 1
  ), false),
  'ledger append function is service-role only'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'payment_checkout_sessions'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%proposal_id%scope_change_id%'
  ),
  'checkout sessions constrain purpose to exactly one durable economic target'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_checkout_sessions'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%request_nonce%'
  ),
  'checkout request nonce is unique'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_provider_accounts'
      and indexdef like 'CREATE UNIQUE INDEX%'
      and indexdef like '%provider_user_id%provider_name%'
  ),
  'one provider account row exists per user and payment provider'
);

select * from finish();
rollback;
