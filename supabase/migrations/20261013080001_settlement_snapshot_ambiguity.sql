-- Fix pre-existente (HEAD): get_job_settlement_snapshot nunca pudo
-- ejecutarse: los OUT params job_id y currency_code colisionan con las
-- columnas de job_scope_changes y plpgsql aborta con 42702 'column
-- reference is ambiguous'. Se califica con el nombre de tabla; cero
-- cambio de comportamiento. Detectado al verificar el slice Lifecycle
-- (falla idéntica sin sus migraciones).
-- Append-only: no se edita 20261011000007_job_settlement.sql.

create or replace function public.get_job_settlement_snapshot(target_job_id uuid)
returns table (
  job_id uuid,
  proposal_id uuid,
  client_user_id uuid,
  provider_user_id uuid,
  service_title text,
  scope_snapshot text,
  amount_minor bigint,
  currency_code text,
  included_scope_change_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.jobs%rowtype;
  accepted_version public.proposal_versions%rowtype;
  extras_total bigint;
  included uuid[];
  total bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'settlement snapshot is server-only';
  end if;

  select * into target_job from public.jobs where id = target_job_id;
  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;
  if target_job.status <> 'COMPLETED' then
    raise exception using errcode = '42501', message = 'job settlement requires a completed job';
  end if;
  if public.job_is_settled(target_job.id) then
    raise exception using errcode = '40001', message = 'job is already settled';
  end if;

  select * into accepted_version
  from public.proposal_versions
  where id = target_job.accepted_proposal_version_id;
  if accepted_version.id is null then
    raise exception using errcode = 'P0002', message = 'accepted proposal version not found';
  end if;

  select
    coalesce(array_agg(id order by id) filter (where id is not null), '{}'),
    coalesce(sum(additional_amount_minor), 0)
  into included, extras_total
  from public.job_scope_changes
  where public.job_scope_changes.job_id = target_job.id
    and status in ('AWAITING_PAYMENT', 'PAYMENT_FAILED');

  if exists (
    select 1 from public.job_scope_changes
    where id = any (included)
      and public.job_scope_changes.currency_code <> accepted_version.currency_code
  ) then
    raise exception using errcode = '22023', message = 'settlement currency mismatch';
  end if;

  total := coalesce(accepted_version.price_amount, 0) + extras_total;
  if total <= 0 then
    raise exception using errcode = '22023', message = 'job has no amount to settle';
  end if;

  return query select
    target_job.id,
    accepted_version.proposal_id,
    target_job.client_user_id,
    target_job.provider_user_id,
    accepted_version.service_title_snapshot,
    accepted_version.scope_snapshot,
    total,
    accepted_version.currency_code,
    included;
end;
$$;

revoke all on function public.get_job_settlement_snapshot(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_settlement_snapshot(uuid)
to service_role;
