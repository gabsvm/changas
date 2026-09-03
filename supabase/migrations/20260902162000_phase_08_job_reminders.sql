-- Phase 08: idempotent upcoming-job reminders.
-- Reminder copy is intentionally generic: no exact address, access note, chat text,
-- identity data or other private fields are copied into notification surfaces.

create or replace function public.materialize_due_job_reminders(
  effective_now timestamptz default timezone('utc', now())
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  materialized_count integer := 0;
begin
  for candidate in
    select
      job.id as job_id,
      job.current_schedule_version_id as schedule_version_id,
      recipient.user_id as recipient_user_id
    from public.jobs job
    join public.job_schedule_versions schedule
      on schedule.id = job.current_schedule_version_id
    cross join lateral (
      values (job.client_user_id), (job.provider_user_id)
    ) as recipient(user_id)
    left join public.notification_preferences preference
      on preference.user_id = recipient.user_id
    where job.status = 'CONFIRMED'::public.job_status
      and coalesce(schedule.starts_at, schedule.deadline_at) is not null
      and coalesce(schedule.starts_at, schedule.deadline_at) > effective_now
      and coalesce(schedule.starts_at, schedule.deadline_at) <= effective_now + interval '24 hours'
      and coalesce(preference.job_reminders_enabled, true)
    order by coalesce(schedule.starts_at, schedule.deadline_at), job.id, recipient.user_id
  loop
    perform public.enqueue_user_notification(
      candidate.recipient_user_id,
      'JOB'::public.notification_kind,
      'Tenés un trabajo próximo',
      'Revisá los detalles actualizados del trabajo en Changas.',
      '/jobs/' || candidate.job_id::text,
      'JOB_REMINDER_24H',
      candidate.schedule_version_id,
      'job',
      candidate.job_id,
      true,
      true
    );
    materialized_count := materialized_count + 1;
  end loop;

  return materialized_count;
end;
$$;

revoke all on function public.materialize_due_job_reminders(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.materialize_due_job_reminders(timestamptz)
to service_role;
