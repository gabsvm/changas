-- Phase 08: in-app notification authority, channel preferences, push subscriptions and delivery outbox.

create type public.notification_kind as enum (
  'MESSAGE',
  'PROPOSAL',
  'PAYMENT',
  'JOB',
  'REVIEW',
  'VERIFICATION',
  'SECURITY',
  'MODERATION'
);

create type public.notification_delivery_channel as enum ('PUSH', 'EMAIL');
create type public.notification_delivery_status as enum ('PENDING', 'LEASED', 'SENT', 'FAILED');

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 280),
  action_url text check (
    action_url is null
    or action_url ~ '^/(messages|jobs|account|provider)(/|$)'
  ),
  entity_type text check (entity_type is null or char_length(entity_type) between 1 and 48),
  entity_id uuid,
  source_event_type text not null check (char_length(source_event_type) between 1 and 80),
  source_event_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  constraint notifications_source_dedupe_key unique (
    recipient_user_id,
    source_event_type,
    source_event_id,
    kind
  )
);

create index notifications_recipient_created_idx
on public.notifications (recipient_user_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
on public.notifications (recipient_user_id, created_at desc)
where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_actionable_enabled boolean not null default false,
  email_important_enabled boolean not null default true,
  job_reminders_enabled boolean not null default true,
  proposal_alerts_enabled boolean not null default true,
  verification_alerts_enabled boolean not null default true,
  promotional_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 8 and 4096),
  p256dh text not null check (char_length(p256dh) between 8 and 4096),
  auth_key text not null check (char_length(auth_key) between 4 and 4096),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create table public.notification_delivery_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  channel public.notification_delivery_channel not null,
  push_subscription_id uuid references public.push_subscriptions (id) on delete cascade,
  status public.notification_delivery_status not null default 'PENDING',
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  available_at timestamptz not null default timezone('utc', now()),
  lease_token uuid,
  leased_until timestamptz,
  sent_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (channel = 'PUSH' and push_subscription_id is not null)
    or (channel = 'EMAIL' and push_subscription_id is null)
  )
);

create unique index notification_delivery_push_dedupe_idx
on public.notification_delivery_outbox (notification_id, push_subscription_id)
where channel = 'PUSH';

create unique index notification_delivery_email_dedupe_idx
on public.notification_delivery_outbox (notification_id)
where channel = 'EMAIL';

create index notification_delivery_claim_idx
on public.notification_delivery_outbox (status, available_at, created_at)
where status in ('PENDING', 'LEASED');

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create trigger notification_delivery_outbox_set_updated_at
before update on public.notification_delivery_outbox
for each row execute function public.set_updated_at();

create or replace function public.ensure_notification_preferences(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'target user is required';
  end if;

  insert into public.notification_preferences (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.ensure_notification_preferences(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.ensure_notification_preferences(uuid)
to service_role;

create or replace function public.create_notification_preferences_for_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_notification_preferences_for_profile()
from public, anon, authenticated, service_role;

create trigger phase08_notification_preferences_on_profile_created
after insert on public.profiles
for each row execute function public.create_notification_preferences_for_profile();

insert into public.notification_preferences (user_id)
select profile.id
from public.profiles profile
on conflict (user_id) do nothing;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_delivery_outbox enable row level security;

create policy notifications_select_own
on public.notifications for select to authenticated
using (recipient_user_id = (select auth.uid()));

create policy notification_preferences_select_own
on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy push_subscriptions_select_own
on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.notification_delivery_outbox from anon, authenticated;

grant select on table public.notifications to authenticated;
grant select on table public.notification_preferences to authenticated;
grant select on table public.push_subscriptions to authenticated;

grant all on table public.notifications to service_role;
grant all on table public.notification_preferences to service_role;
grant all on table public.push_subscriptions to service_role;
grant all on table public.notification_delivery_outbox to service_role;

create or replace function public.list_my_notifications(
  page_size integer default 30,
  before_created_at timestamptz default null,
  before_id uuid default null
)
returns table (
  notification_id uuid,
  kind public.notification_kind,
  title text,
  body text,
  action_url text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_page_size integer := least(greatest(coalesce(page_size, 30), 1), 100);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    notification.id,
    notification.kind,
    notification.title,
    notification.body,
    notification.action_url,
    notification.entity_type,
    notification.entity_id,
    notification.created_at,
    notification.read_at
  from public.notifications notification
  where notification.recipient_user_id = caller_id
    and (
      before_created_at is null
      or (notification.created_at, notification.id) < (before_created_at, coalesce(before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by notification.created_at desc, notification.id desc
  limit bounded_page_size;
end;
$$;

create or replace function public.get_my_notification_unread_count()
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  unread_count bigint;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select count(*) into unread_count
  from public.notifications notification
  where notification.recipient_user_id = caller_id
    and notification.read_at is null;

  return unread_count;
end;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  affected integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, timezone('utc', now()))
  where id = target_notification_id
    and recipient_user_id = caller_id;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  affected bigint;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  update public.notifications
  set read_at = timezone('utc', now())
  where recipient_user_id = caller_id
    and read_at is null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.get_my_notification_preferences()
returns table (
  push_actionable_enabled boolean,
  email_important_enabled boolean,
  job_reminders_enabled boolean,
  proposal_alerts_enabled boolean,
  verification_alerts_enabled boolean,
  promotional_enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  insert into public.notification_preferences (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  return query
  select
    preference.push_actionable_enabled,
    preference.email_important_enabled,
    preference.job_reminders_enabled,
    preference.proposal_alerts_enabled,
    preference.verification_alerts_enabled,
    preference.promotional_enabled,
    preference.updated_at
  from public.notification_preferences preference
  where preference.user_id = caller_id;
end;
$$;

create or replace function public.update_my_notification_preferences(
  requested_push_actionable_enabled boolean,
  requested_email_important_enabled boolean,
  requested_job_reminders_enabled boolean,
  requested_proposal_alerts_enabled boolean,
  requested_verification_alerts_enabled boolean,
  requested_promotional_enabled boolean
)
returns table (
  push_actionable_enabled boolean,
  email_important_enabled boolean,
  job_reminders_enabled boolean,
  proposal_alerts_enabled boolean,
  verification_alerts_enabled boolean,
  promotional_enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  insert into public.notification_preferences (
    user_id,
    push_actionable_enabled,
    email_important_enabled,
    job_reminders_enabled,
    proposal_alerts_enabled,
    verification_alerts_enabled,
    promotional_enabled
  ) values (
    caller_id,
    coalesce(requested_push_actionable_enabled, false),
    coalesce(requested_email_important_enabled, true),
    coalesce(requested_job_reminders_enabled, true),
    coalesce(requested_proposal_alerts_enabled, true),
    coalesce(requested_verification_alerts_enabled, true),
    coalesce(requested_promotional_enabled, false)
  )
  on conflict (user_id) do update set
    push_actionable_enabled = excluded.push_actionable_enabled,
    email_important_enabled = excluded.email_important_enabled,
    job_reminders_enabled = excluded.job_reminders_enabled,
    proposal_alerts_enabled = excluded.proposal_alerts_enabled,
    verification_alerts_enabled = excluded.verification_alerts_enabled,
    promotional_enabled = excluded.promotional_enabled;

  return query
  select
    preference.push_actionable_enabled,
    preference.email_important_enabled,
    preference.job_reminders_enabled,
    preference.proposal_alerts_enabled,
    preference.verification_alerts_enabled,
    preference.promotional_enabled,
    preference.updated_at
  from public.notification_preferences preference
  where preference.user_id = caller_id;
end;
$$;

create or replace function public.upsert_push_subscription(
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  subscription_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if char_length(coalesce(subscription_endpoint, '')) < 8
    or char_length(coalesce(subscription_p256dh, '')) < 8
    or char_length(coalesce(subscription_auth, '')) < 4 then
    raise exception using errcode = '22023', message = 'invalid push subscription';
  end if;

  insert into public.notification_preferences (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_key,
    user_agent
  ) values (
    caller_id,
    subscription_endpoint,
    subscription_p256dh,
    subscription_auth,
    nullif(subscription_user_agent, '')
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth_key = excluded.auth_key,
    user_agent = excluded.user_agent,
    updated_at = timezone('utc', now())
  returning id into subscription_id;

  return subscription_id;
end;
$$;

create or replace function public.delete_push_subscription(subscription_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  affected integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  delete from public.push_subscriptions
  where user_id = caller_id
    and endpoint = subscription_endpoint;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.enqueue_user_notification(
  target_recipient_user_id uuid,
  notification_kind_value public.notification_kind,
  safe_title text,
  safe_body text,
  notification_action_url text,
  source_event_type_value text,
  source_event_id_value uuid,
  entity_type_value text default null,
  entity_id_value uuid default null,
  push_eligible boolean default false,
  email_eligible boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_notification_id uuid;
  preference public.notification_preferences%rowtype;
begin
  if target_recipient_user_id is null or source_event_id_value is null then
    raise exception using errcode = '22023', message = 'recipient and source event are required';
  end if;

  insert into public.notification_preferences (user_id)
  values (target_recipient_user_id)
  on conflict (user_id) do nothing;

  insert into public.notifications (
    recipient_user_id,
    kind,
    title,
    body,
    action_url,
    entity_type,
    entity_id,
    source_event_type,
    source_event_id
  ) values (
    target_recipient_user_id,
    notification_kind_value,
    safe_title,
    safe_body,
    notification_action_url,
    entity_type_value,
    entity_id_value,
    source_event_type_value,
    source_event_id_value
  )
  on conflict on constraint notifications_source_dedupe_key do nothing
  returning id into created_notification_id;

  if created_notification_id is null then
    select notification.id into created_notification_id
    from public.notifications notification
    where notification.recipient_user_id = target_recipient_user_id
      and notification.source_event_type = source_event_type_value
      and notification.source_event_id = source_event_id_value
      and notification.kind = notification_kind_value;
    return created_notification_id;
  end if;

  select * into preference
  from public.notification_preferences
  where user_id = target_recipient_user_id;

  if coalesce(push_eligible, false) and preference.push_actionable_enabled then
    insert into public.notification_delivery_outbox (
      notification_id,
      recipient_user_id,
      channel,
      push_subscription_id
    )
    select
      created_notification_id,
      target_recipient_user_id,
      'PUSH'::public.notification_delivery_channel,
      subscription.id
    from public.push_subscriptions subscription
    where subscription.user_id = target_recipient_user_id
    on conflict do nothing;
  end if;

  if coalesce(email_eligible, false) and preference.email_important_enabled then
    insert into public.notification_delivery_outbox (
      notification_id,
      recipient_user_id,
      channel,
      push_subscription_id
    ) values (
      created_notification_id,
      target_recipient_user_id,
      'EMAIL',
      null
    )
    on conflict do nothing;
  end if;

  return created_notification_id;
end;
$$;

create or replace function public.claim_notification_deliveries(
  requested_batch_size integer default 25,
  requested_lease_seconds integer default 120
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  recipient_user_id uuid,
  channel public.notification_delivery_channel,
  title text,
  body text,
  action_url text,
  endpoint text,
  p256dh text,
  auth_key text,
  recipient_email text,
  lease_token uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  bounded_batch_size integer := least(greatest(coalesce(requested_batch_size, 25), 1), 100);
  bounded_lease_seconds integer := least(greatest(coalesce(requested_lease_seconds, 120), 30), 600);
begin
  return query
  with candidates as (
    select delivery.id
    from public.notification_delivery_outbox delivery
    where (
      (delivery.status = 'PENDING' and delivery.available_at <= timezone('utc', now()))
      or (delivery.status = 'LEASED' and delivery.leased_until <= timezone('utc', now()))
    )
    order by delivery.available_at, delivery.created_at, delivery.id
    for update skip locked
    limit bounded_batch_size
  ), claimed as (
    update public.notification_delivery_outbox delivery
    set
      status = 'LEASED',
      lease_token = extensions.gen_random_uuid(),
      leased_until = timezone('utc', now()) + make_interval(secs => bounded_lease_seconds),
      attempt_count = delivery.attempt_count + 1,
      last_error_code = null
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.notification_id,
    claimed.recipient_user_id,
    claimed.channel,
    notification.title,
    notification.body,
    notification.action_url,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth_key,
    auth_user.email::text,
    claimed.lease_token,
    claimed.attempt_count
  from claimed
  join public.notifications notification on notification.id = claimed.notification_id
  left join public.push_subscriptions subscription on subscription.id = claimed.push_subscription_id
  left join auth.users auth_user on auth_user.id = claimed.recipient_user_id
  order by claimed.created_at, claimed.id;
end;
$$;

create or replace function public.record_notification_delivery_result(
  target_delivery_id uuid,
  target_lease_token uuid,
  delivery_succeeded boolean,
  delivery_retryable boolean default false,
  delivery_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  affected integer;
begin
  update public.notification_delivery_outbox delivery
  set
    status = case
      when coalesce(delivery_succeeded, false) then 'SENT'::public.notification_delivery_status
      when coalesce(delivery_retryable, false) then 'PENDING'::public.notification_delivery_status
      else 'FAILED'::public.notification_delivery_status
    end,
    available_at = case
      when not coalesce(delivery_succeeded, false) and coalesce(delivery_retryable, false)
        then timezone('utc', now()) + (least(delivery.attempt_count, 6) * interval '5 minutes')
      else delivery.available_at
    end,
    sent_at = case
      when coalesce(delivery_succeeded, false) then timezone('utc', now())
      else delivery.sent_at
    end,
    last_error_code = case
      when coalesce(delivery_succeeded, false) then null
      else left(nullif(delivery_error_code, ''), 120)
    end,
    lease_token = null,
    leased_until = null
  where delivery.id = target_delivery_id
    and delivery.status = 'LEASED'
    and delivery.lease_token = target_lease_token;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.list_my_notifications(integer, timestamptz, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.get_my_notification_unread_count()
from public, anon, authenticated, service_role;
revoke all on function public.mark_notification_read(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.mark_all_notifications_read()
from public, anon, authenticated, service_role;
revoke all on function public.get_my_notification_preferences()
from public, anon, authenticated, service_role;
revoke all on function public.update_my_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.upsert_push_subscription(text, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.delete_push_subscription(text)
from public, anon, authenticated, service_role;
revoke all on function public.enqueue_user_notification(uuid, public.notification_kind, text, text, text, text, uuid, text, uuid, boolean, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.claim_notification_deliveries(integer, integer)
from public, anon, authenticated, service_role;
revoke all on function public.record_notification_delivery_result(uuid, uuid, boolean, boolean, text)
from public, anon, authenticated, service_role;

grant execute on function public.list_my_notifications(integer, timestamptz, uuid)
to authenticated, service_role;
grant execute on function public.get_my_notification_unread_count()
to authenticated, service_role;
grant execute on function public.mark_notification_read(uuid)
to authenticated, service_role;
grant execute on function public.mark_all_notifications_read()
to authenticated, service_role;
grant execute on function public.get_my_notification_preferences()
to authenticated, service_role;
grant execute on function public.update_my_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean)
to authenticated, service_role;
grant execute on function public.upsert_push_subscription(text, text, text, text)
to authenticated, service_role;
grant execute on function public.delete_push_subscription(text)
to authenticated, service_role;
grant execute on function public.enqueue_user_notification(uuid, public.notification_kind, text, text, text, text, uuid, text, uuid, boolean, boolean)
to service_role;
grant execute on function public.claim_notification_deliveries(integer, integer)
to service_role;
grant execute on function public.record_notification_delivery_result(uuid, uuid, boolean, boolean, text)
to service_role;
