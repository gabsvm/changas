-- YALO C1: resumen de ingresos honesto del proveedor.
--
-- El bloque "Resumen de ingresos" sumaba settlement_total_minor de hasta
-- 50+50 filas de list_my_past/upcoming_jobs y rotulaba "Cobrado":
--   * recorte arbitrario (falsos totales con 50+ trabajos por listado),
--   * para jobs SETTLED usaba base + impagos actuales, que omite adicionales
--     ya liquidados (los scope-changes pasan a PAID tras liquidar), y
--   * finge liquidación con pagos OFF (intentos FAKE/simulados cuentan igual
--     que cobros reales).
-- Fix append-only: nuevo agregado get_provider_earnings_summary()
-- (SECURITY DEFINER, grants como sus hermanas):
--   * totales y conteos server-side sin límite arbitrario,
--   * ganado usa montos liquidados vía intentos SUCCEEDED
--     (settled_amount_for_job, inmutable) cuando existan,
--   * pendiente usa base + impagos (misma definición que los read models),
--   * separa simulado (provider_name = 'FAKE') de real sin tocar estados
--     monetarios: solo lectura, ningún INSERT/UPDATE.
-- La UI rotula Estimado con pagos OFF y nunca "Cobrado" sin transacción
-- real; con fallback al cálculo anterior si el RPC aún no existe
-- (deploy ordering). Sin push a prod (runbook manual).

create or replace function public.get_provider_earnings_summary()
returns table (
  settled_count bigint,
  settled_total_minor bigint,
  simulated_settled_count bigint,
  simulated_settled_total_minor bigint,
  due_count bigint,
  due_total_minor bigint,
  in_progress_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  with mine as (
    select
      job.id,
      job.status,
      coalesce(accepted_version.price_amount, 0) as base_amount
    from public.jobs job
    join public.proposal_versions accepted_version
      on accepted_version.id = job.accepted_proposal_version_id
    where job.provider_user_id = caller_id
  ),
  per_job as (
    select
      job.id,
      job.status,
      job.base_amount,
      public.unpaid_scope_additional_for_job(job.id) as unpaid_extras,
      public.job_is_settled(job.id) as is_settled,
      public.settled_amount_for_job(job.id) as settled_amount,
      (
        select attempt.provider_name
        from public.job_settlement_attempts attempt
        where attempt.job_id = job.id
          and attempt.status = 'SUCCEEDED'
        limit 1
      ) as settle_provider_name
    from mine job
  )
  select
    count(*) filter (
      where per_job.status = 'COMPLETED'
        and per_job.is_settled
        and coalesce(per_job.settle_provider_name, 'FAKE') <> 'FAKE'
    ),
    coalesce(sum(per_job.settled_amount) filter (
      where per_job.status = 'COMPLETED'
        and per_job.is_settled
        and coalesce(per_job.settle_provider_name, 'FAKE') <> 'FAKE'
    ), 0)::bigint,
    count(*) filter (
      where per_job.status = 'COMPLETED'
        and per_job.is_settled
        and coalesce(per_job.settle_provider_name, 'FAKE') = 'FAKE'
    ),
    coalesce(sum(per_job.settled_amount) filter (
      where per_job.status = 'COMPLETED'
        and per_job.is_settled
        and coalesce(per_job.settle_provider_name, 'FAKE') = 'FAKE'
    ), 0)::bigint,
    count(*) filter (
      where per_job.status = 'COMPLETED'
        and not per_job.is_settled
        and per_job.base_amount + coalesce(per_job.unpaid_extras, 0) > 0
    ),
    coalesce(sum(
      per_job.base_amount + coalesce(per_job.unpaid_extras, 0)
    ) filter (
      where per_job.status = 'COMPLETED'
        and not per_job.is_settled
        and per_job.base_amount + coalesce(per_job.unpaid_extras, 0) > 0
    ), 0)::bigint,
    count(*) filter (
      where per_job.status in ('CONFIRMED', 'IN_PROGRESS', 'COMPLETION_REQUESTED')
    )
  from per_job;
end;
$$;

revoke all on function public.get_provider_earnings_summary()
from public, anon, authenticated, service_role;
grant execute on function public.get_provider_earnings_summary()
to authenticated, service_role;
