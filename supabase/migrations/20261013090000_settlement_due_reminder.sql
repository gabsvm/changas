-- Recordatorio de cobro pendiente antiguo: COMPLETED sin liquidar y con
-- monto a cobrar > 0 (DUE) cuya última actualización supera las 72h. Se avisa
-- al cliente (quien paga) con kind PAYMENT y tipo nuevo
-- SETTLEMENT_DUE_REMINDER sobre la infra existente (enqueue + dispatcher +
-- cron): sin tocar el enum notification_kind ni el dispatcher.
-- Dedupeado por (cliente, tipo, job, kind) en el enqueue: repetir el
-- materialize no duplica avisos.

create or replace function public.materialize_due_settlement_reminders(
  effective_now timestamptz default timezone('utc', now())
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  candidate record;
  materialized_count integer := 0;
begin
  for candidate in
    select
      job.id as job_id,
      job.client_user_id as recipient_user_id
    from public.jobs job
    join public.proposal_versions accepted_version
      on accepted_version.id = job.accepted_proposal_version_id
    where job.status = 'COMPLETED'::public.job_status
      and not public.job_is_settled(job.id)
      and coalesce(accepted_version.price_amount, 0)
        + public.unpaid_scope_additional_for_job(job.id) > 0
      and job.updated_at <= effective_now - interval '72 hours'
    order by job.updated_at, job.id
  loop
    perform public.enqueue_user_notification(
      candidate.recipient_user_id,
      'PAYMENT'::public.notification_kind,
      'Tenés un pago pendiente',
      'El trabajo ya está completo y el cobro sigue pendiente. Abrilo para completar el pago.',
      '/jobs/' || candidate.job_id::text,
      'SETTLEMENT_DUE_REMINDER',
      candidate.job_id,
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

revoke all on function public.materialize_due_settlement_reminders(timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.materialize_due_settlement_reminders(timestamptz)
to service_role;

-- El dispatch existente (cada 5 min) los envía; se materializa cada 6h.
select cron.schedule(
  'settlement-due-reminders',
  '0 */6 * * *',
  'select public.materialize_due_settlement_reminders()'
);
