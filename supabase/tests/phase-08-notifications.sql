begin;

select plan(24);

select ok(to_regclass('public.notifications') is not null, 'notifications table exists');
select ok(to_regclass('public.notification_preferences') is not null, 'notification preferences table exists');
select ok(to_regclass('public.push_subscriptions') is not null, 'push subscriptions table exists');
select ok(to_regclass('public.notification_delivery_outbox') is not null, 'notification delivery outbox exists');

select ok(
  coalesce((
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'notifications',
        'notification_preferences',
        'push_subscriptions',
        'notification_delivery_outbox'
      )
    having count(*) = 4
  ), false),
  'all Phase 08 notification tables keep RLS enabled'
);

select ok(
  coalesce((
    select has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'notifications'
  ), false),
  'authenticated notification table access is read-only'
);

select ok(
  coalesce((
    select has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'notification_preferences'
  ), false),
  'preferences are read-only at the table boundary'
);

select ok(
  coalesce((
    select has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'push_subscriptions'
  ), false),
  'push subscriptions are read-only at the table boundary'
);

select ok(
  coalesce((
    select not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'notification_delivery_outbox'
  ), false),
  'delivery outbox is hidden from browser roles'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'notification_preferences_pkey'
  ),
  'preferences keep one row per user'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_user_endpoint_key'
  ),
  'push endpoints are unique per user'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'notifications_source_dedupe_key'
  ),
  'notification source events are deduplicated per recipient'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_my_notifications'
  ),
  'list_my_notifications rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_notification_unread_count'
  ),
  'get_my_notification_unread_count rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mark_notification_read'
  ),
  'mark_notification_read rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mark_all_notifications_read'
  ),
  'mark_all_notifications_read rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_notification_preferences'
  ),
  'get_my_notification_preferences rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_my_notification_preferences'
  ),
  'update_my_notification_preferences rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_push_subscription'
  ),
  'upsert_push_subscription rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_push_subscription'
  ),
  'delete_push_subscription rpc exists'
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
        'list_my_notifications',
        'get_my_notification_unread_count',
        'mark_notification_read',
        'mark_all_notifications_read',
        'get_my_notification_preferences',
        'update_my_notification_preferences',
        'upsert_push_subscription',
        'delete_push_subscription'
      )
    having count(*) = 8
  ), false),
  'notification browser RPCs are authenticated-only'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enqueue_user_notification'
  ),
  'private notification enqueue helper exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_notification_deliveries'
  ),
  'delivery claim rpc exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_notification_delivery_result'
  ),
  'delivery result rpc exists'
);

select ok(
  coalesce((
    select bool_and(
      not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'enqueue_user_notification',
        'claim_notification_deliveries',
        'record_notification_delivery_result'
      )
    having count(*) = 3
  ), false),
  'enqueue and delivery internals are not executable by browser roles'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_subscriptions'
      and column_name in ('vapid_private_key', 'private_key')
  ),
  'push subscription rows never contain server VAPID private material'
);

select * from finish();
rollback;