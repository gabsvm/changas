-- Supabase-native scheduler for the notification outbox.
--
-- Push/email delivery is implemented in the Next.js route
-- /api/internal/notifications/dispatch (VAPID signing, Resend). Nothing was
-- calling it, so queued notifications never left the outbox. pg_cron calls it
-- every 5 minutes through pg_net.
--
-- The URL and the shared secret live in Supabase Vault, never in this file.
-- Create them once from the SQL editor:
--   select vault.create_secret('https://YOUR-DOMAIN/api/internal/notifications/dispatch', 'notification_dispatch_url');
--   select vault.create_secret('<same value as NOTIFICATION_DISPATCH_SECRET in Vercel>', 'notification_dispatch_secret');
-- Until both exist the job is a no-op.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.dispatch_notifications()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  dispatch_url text;
  dispatch_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into dispatch_url
  from vault.decrypted_secrets
  where name = 'notification_dispatch_url';

  select decrypted_secret
    into dispatch_secret
  from vault.decrypted_secrets
  where name = 'notification_dispatch_secret';

  if dispatch_url is null or dispatch_secret is null then
    return null;
  end if;

  select net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || dispatch_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.dispatch_notifications()
from public, anon, authenticated;

select cron.schedule(
  'notification-dispatch',
  '*/5 * * * *',
  'select public.dispatch_notifications()'
);
