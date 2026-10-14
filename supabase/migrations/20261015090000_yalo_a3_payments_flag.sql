-- YALO A3: notificaciones de cobro honestas con pagos OFF.
--
-- La migración 20261013090000 programa 'settlement-due-reminders' cada 6h
-- con el texto «Abrilo para completar el pago», imposible mientras el
-- checkout está OFF: ordena una acción que no existe. Fix append-only:
--   1) Tabla app_feature_flags(name, enabled) + flag 'payments_online'
--      default false: la política futura vive tras el flag, no en el cron.
--   2) materialize_due_settlement_reminders retorna 0 sin materializar
--      mientras el flag esté OFF (sin notificaciones de deuda imposible).
--      Con el flag ON, comportamiento original intacto.
-- No toca el schedule del cron (pausarlo en prod exige autorización
-- explícita) ni el dispatcher. Sin push a prod (runbook manual).

create table if not exists public.app_feature_flags (
  name text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_feature_flags enable row level security;
revoke all privileges on table public.app_feature_flags
from public, anon, authenticated, service_role;

insert into public.app_feature_flags (name, enabled)
values ('payments_online', false)
on conflict (name) do nothing;

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
  online boolean;
begin
  -- YALO A3: sin cobro online no hay deuda exigible que recordar.
  select coalesce(
    (select enabled from public.app_feature_flags where name = 'payments_online'),
    false
  ) into online;
  if not online then
    return 0;
  end if;

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
