-- Nudge de reseña post-pago: cuando el cierre se acredita, se invita al
-- cliente a dejar reseña. Dedupeado por (evento, kind) en el enqueue.

create or replace function public.notify_settlement_review_nudge()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_client_id uuid;
begin
  if new.event_type <> 'JOB_SETTLEMENT_SUCCEEDED' then
    return new;
  end if;

  select j.client_user_id into target_client_id
  from public.jobs j
  where j.id = new.job_id;

  if target_client_id is null then
    return new;
  end if;

  perform public.enqueue_user_notification(
    target_client_id,
    'REVIEW'::public.notification_kind,
    '¿Cómo te fue?',
    'El pago ya está acreditado. Contanos con una reseña cómo salió el trabajo.',
    '/jobs/' || new.job_id::text,
    'SETTLEMENT_REVIEW_NUDGE',
    new.id,
    'job',
    new.job_id,
    true,
    true
  );

  return new;
end;
$$;

drop trigger if exists settlement_review_nudge on public.job_events;
create trigger settlement_review_nudge
after insert on public.job_events
for each row execute function public.notify_settlement_review_nudge();

revoke all on function public.notify_settlement_review_nudge()
from public, anon, authenticated, service_role;
