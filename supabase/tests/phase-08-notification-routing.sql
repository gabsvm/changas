begin;

select plan(10);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase08_route_message_notification'
  ),
  'message notification router exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase08_route_proposal_event_notification'
  ),
  'proposal and payment notification router exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase08_route_job_event_notification'
  ),
  'job event notification router exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase08_route_review_notification'
  ),
  'review notification router exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase08_route_provider_verification_notification'
  ),
  'provider verification notification router exists'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'messages'
      and t.tgname = 'phase08_notify_message_created'
      and not t.tgisinternal
  ),
  'messages have a durable notification trigger'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'proposal_events'
      and t.tgname = 'phase08_notify_proposal_event_created'
      and not t.tgisinternal
  ),
  'proposal/payment events have a durable notification trigger'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'job_events'
      and t.tgname = 'phase08_notify_job_event_created'
      and not t.tgisinternal
  ),
  'job events have a durable notification trigger'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'reviews'
      and t.tgname = 'phase08_notify_review_created'
      and not t.tgisinternal
  ),
  'reviews have a durable notification trigger'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_profiles'
      and t.tgname = 'phase08_notify_provider_verification_changed'
      and not t.tgisinternal
  ),
  'provider verification changes have a durable notification trigger'
);

select * from finish();
rollback;
