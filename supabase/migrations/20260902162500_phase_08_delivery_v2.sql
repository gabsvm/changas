-- Phase 08: delivery claim v2 adds routing metadata needed by the server dispatcher.
-- Browser roles never receive access to this lease authority.

create or replace function public.claim_notification_deliveries_v2(
  requested_batch_size integer default 25,
  requested_lease_seconds integer default 120
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  recipient_user_id uuid,
  channel public.notification_delivery_channel,
  notification_kind public.notification_kind,
  title text,
  body text,
  action_url text,
  source_event_type text,
  endpoint text,
  p256dh text,
  auth_key text,
  recipient_email text,
  lease_token uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  bounded_batch_size integer := least(
    greatest(coalesce(requested_batch_size, 25), 1),
    100
  );
  bounded_lease_seconds integer := least(
    greatest(coalesce(requested_lease_seconds, 120), 30),
    600
  );
begin
  return query
  with candidates as (
    select delivery.id
    from public.notification_delivery_outbox delivery
    where (
      (
        delivery.status = 'PENDING'::public.notification_delivery_status
        and delivery.available_at <= timezone('utc', now())
      )
      or (
        delivery.status = 'LEASED'::public.notification_delivery_status
        and delivery.leased_until <= timezone('utc', now())
      )
    )
    order by delivery.available_at, delivery.created_at, delivery.id
    for update skip locked
    limit bounded_batch_size
  ), claimed as (
    update public.notification_delivery_outbox delivery
    set
      status = 'LEASED'::public.notification_delivery_status,
      lease_token = extensions.gen_random_uuid(),
      leased_until = timezone('utc', now())
        + make_interval(secs => bounded_lease_seconds),
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
    notification.kind,
    notification.title,
    notification.body,
    notification.action_url,
    notification.source_event_type,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth_key,
    auth_user.email::text,
    claimed.lease_token,
    claimed.attempt_count
  from claimed
  join public.notifications notification
    on notification.id = claimed.notification_id
  left join public.push_subscriptions subscription
    on subscription.id = claimed.push_subscription_id
  left join auth.users auth_user
    on auth_user.id = claimed.recipient_user_id
  order by claimed.created_at, claimed.id;
end;
$$;

revoke all on function public.claim_notification_deliveries_v2(integer, integer)
from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_deliveries_v2(integer, integer)
to service_role;
