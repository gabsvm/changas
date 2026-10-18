-- YALO S4 extension: voluntary external tips (cash/transfer), 2026-10-16.
-- Append-only migration. No changes to Mercado Pago, online payments or balances.
-- YALO does not receive, hold or verify this money; each party confirms an
-- external transfer. Existing confirmed rows keep tip_amount_minor=0.
-- Deployment order: apply this migration first; then deploy the app read model.
--
-- SAFETY: contractual confirmed = SUM(amount_minor - tip_amount_minor).
--         tip confirmed = SUM(tip_amount_minor).
--         outstanding = MAX(agreed - contractual confirmed, 0).
-- Preserve locking, authorization, idempotency, rejection and void behavior.

alter table public.external_payment_declarations
  add column if not exists tip_amount_minor bigint not null default 0;

alter table public.external_payment_declarations
  drop constraint if exists external_payment_tip_bounds_check;

alter table public.external_payment_declarations
  add constraint external_payment_tip_bounds_check
  check (tip_amount_minor >= 0 and tip_amount_minor <= amount_minor);

comment on column public.external_payment_declarations.tip_amount_minor is
  'Tip component allocated on mutual confirmation of external money; excluded from the contractual agreed/outstanding totals.';

-- Existing ledger RPC shape stays unchanged for compatibility.
-- external_confirmed_minor counts CONTRACTUAL portion only; tips can be
-- summed from per-declaration tip_amount_minor in the authorized read model.
create or replace function public.external_payment_ledger(target_job_id uuid)
returns table (
  agreed_total_minor bigint,
  external_confirmed_minor bigint,
  external_claimed_minor bigint,
  external_outstanding_minor bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  agreed bigint;
  confirmed bigint;
  claimed bigint;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1 from public.jobs j
    where j.id = target_job_id
      and caller_id in (j.client_user_id, j.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  agreed := public.external_agreed_total_for_job(target_job_id);

  select coalesce(sum(d.amount_minor - d.tip_amount_minor), 0) into confirmed
  from public.external_payment_declarations d
  where d.job_id = target_job_id
    and d.state = 'CONFIRMED_BY_BOTH';

  select coalesce(sum(d.amount_minor), 0) into claimed
  from public.external_payment_declarations d
  where d.job_id = target_job_id
    and d.state in ('DECLARED_BY_CLIENT', 'DECLARED_BY_PROVIDER');

  return query select agreed, confirmed, claimed, greatest(agreed - confirmed, 0);
end;
$$;


-- Allow amounts above the contractual balance; the tip is not accepted yet.
create or replace function public.declare_external_payment(
  target_job_id uuid,
  declared_amount_minor bigint,
  declared_method text,
  declared_paid_on date default null,
  declared_reference text default null,
  request_idempotency_key uuid default null,
  supersedes_declaration_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  pending_count integer;
  new_state public.external_payment_state;
  created_id uuid;
  event_time timestamptz := timezone('utc', now());
  clean_reference text := nullif(btrim(coalesce(declared_reference, '')), '');
  superseded_state public.external_payment_state;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_job_id::text, 0));

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  if target_job.status <> 'COMPLETED' then
    raise exception using errcode = '22023', message = 'external money is registered only on completed jobs';
  end if;

  if request_idempotency_key is not null then
    select d.id into created_id
    from public.external_payment_declarations d
    where d.job_id = target_job_id
      and d.idempotency_key = request_idempotency_key;
    if created_id is not null then
      return created_id;
    end if;
  end if;

  if declared_amount_minor is null or declared_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'declared amount must be positive';
  end if;

  if declared_method not in ('EFECTIVO', 'TRANSFERENCIA', 'OTRO_ACORDADO') then
    raise exception using errcode = '22023', message = 'payment method is invalid';
  end if;

  if clean_reference is not null and char_length(clean_reference) > 140 then
    raise exception using errcode = '22023', message = 'payment reference is invalid';
  end if;

  if declared_paid_on is not null and declared_paid_on > (event_time::date + 1) then
    raise exception using errcode = '22023', message = 'payment date is invalid';
  end if;

  -- A declaration may include a voluntary tip on top of the agreed contract.
  -- Its final contractual/tip allocation happens only on counterpart confirmation.
  -- Preserve bigint amount, the existing idempotency key and the audit event.

  -- El tope cuenta declaraciones accionables (DECLARED_*). CONTESTED es
  -- desacuerdo registrado, no pendiente de acción: no ocupa lugar.
  select count(*) into pending_count
  from public.external_payment_declarations d
  where d.job_id = target_job_id
    and d.state in ('DECLARED_BY_CLIENT', 'DECLARED_BY_PROVIDER');
  if pending_count >= 20 then
    raise exception using errcode = '22023', message = 'too many pending declarations';
  end if;

  if supersedes_declaration_id is not null then
    select d.state into superseded_state
    from public.external_payment_declarations d
    where d.id = supersedes_declaration_id
      and d.job_id = target_job_id
    for update;
    if superseded_state is null then
      raise exception using errcode = 'P0002', message = 'superseded declaration not found';
    end if;
    if superseded_state not in ('DECLARED_BY_CLIENT', 'DECLARED_BY_PROVIDER', 'CONTESTED') then
      raise exception using errcode = '22023', message = 'only open declarations can be superseded';
    end if;
    if not exists (
      select 1 from public.external_payment_declarations d
      where d.id = supersedes_declaration_id
        and d.declared_by_user_id = caller_id
    ) then
      raise exception using errcode = '42501', message = 'only the declarer supersedes a declaration';
    end if;
    update public.external_payment_declarations
    set state = 'VOIDED', updated_at = event_time
    where id = supersedes_declaration_id;
  end if;

  new_state := case
    when caller_id = target_job.client_user_id then 'DECLARED_BY_CLIENT'::public.external_payment_state
    else 'DECLARED_BY_PROVIDER'::public.external_payment_state
  end;

  begin
    insert into public.external_payment_declarations (
      job_id, declared_by_user_id, amount_minor, method, paid_on,
      reference, state, idempotency_key, supersedes_id, created_at, updated_at
    ) values (
      target_job_id, caller_id, declared_amount_minor, declared_method,
      declared_paid_on, clean_reference, new_state, request_idempotency_key,
      supersedes_declaration_id, event_time, event_time
    )
    returning id into created_id;
  exception when unique_violation then
    if request_idempotency_key is not null then
      select d.id into created_id
      from public.external_payment_declarations d
      where d.job_id = target_job_id
        and d.idempotency_key = request_idempotency_key;
      if created_id is not null then
        return created_id;
      end if;
    end if;
    raise;
  end;

  insert into public.job_events (
    job_id, actor_user_id, event_type, reason, created_at
  ) values (
    target_job_id, caller_id, 'JOB_EXTERNAL_PAYMENT_DECLARED',
    new_state::text || ' ' || declared_amount_minor::text, event_time
  );

  return created_id;
end;
$$;


-- Atomic allocation at confirm time under existing job advisory and row locks.
create or replace function public.respond_external_payment(
  target_declaration_id uuid,
  accepted boolean,
  counterpart_reason text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  declaration public.external_payment_declarations%rowtype;
  declaration_job_id uuid;
  target_job public.jobs%rowtype;
  agreed bigint;
  confirmed bigint;
  applied_to_contract bigint;
  tip_minor bigint;
  event_time timestamptz := timezone('utc', now());
  clean_reason text := nullif(btrim(coalesce(counterpart_reason, '')), '');
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  -- Orden global de locks: advisory(job) -> declaration -> job.
  -- Nunca tomar primero el row lock de declaration y luego advisory:
  -- declaration/supersede adquiere advisory antes que cualquier otra fila.
  select d.job_id into declaration_job_id
  from public.external_payment_declarations d
  where d.id = target_declaration_id;
  if declaration_job_id is null then
    raise exception using errcode = 'P0002', message = 'declaration not found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(declaration_job_id::text, 0));

  select * into declaration
  from public.external_payment_declarations
  where id = target_declaration_id
  for update;

  if declaration.id is null then
    raise exception using errcode = 'P0002', message = 'declaration not found';
  end if;

  select * into target_job from public.jobs where id = declaration.job_id for update;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  -- El historial bilateral se congela si el trabajo sale de COMPLETED
  -- (la vía de apelación gobierna el trabajo): fuera de COMPLETED no se
  -- confirma, contesta ni anula.
  if target_job.status <> 'COMPLETED' then
    raise exception using errcode = '22023', message = 'external money is registered only on completed jobs';
  end if;

  if caller_id = declaration.declared_by_user_id then
    raise exception using errcode = '42501', message = 'only the counterpart responds to a declaration';
  end if;

  if declaration.state not in ('DECLARED_BY_CLIENT', 'DECLARED_BY_PROVIDER') then
    raise exception using errcode = '40001', message = 'declaration already resolved; refresh and retry';
  end if;

  if accepted then
    if clean_reason is not null and char_length(clean_reason) > 1000 then
      raise exception using errcode = '22023', message = 'response reason is invalid';
    end if;

    agreed := public.external_agreed_total_for_job(declaration.job_id);
    select coalesce(sum(d.amount_minor - d.tip_amount_minor), 0) into confirmed
    from public.external_payment_declarations d
    where d.job_id = declaration.job_id
      and d.state = 'CONFIRMED_BY_BOTH';

    -- Allocate each confirmed peso first to the remaining contractual balance.
    -- Any excess is a tip. The snapshot is stored per declaration so later
    -- changes to the agreement cannot retroactively reclassify received money.
    applied_to_contract := least(declaration.amount_minor, greatest(agreed - confirmed, 0));
    tip_minor := declaration.amount_minor - applied_to_contract;

    update public.external_payment_declarations
    set state = 'CONFIRMED_BY_BOTH',
        tip_amount_minor = tip_minor,
        updated_at = event_time
    where id = target_declaration_id;

    insert into public.job_events (
      job_id, actor_user_id, event_type, reason, created_at
    ) values (
      declaration.job_id, caller_id, 'JOB_EXTERNAL_PAYMENT_CONFIRMED',
      declaration.amount_minor::text, event_time
    );

    return 'CONFIRMED_BY_BOTH';
  end if;

  if clean_reason is null then
    raise exception using errcode = '22023', message = 'a reason is required to contest a declaration';
  end if;

  update public.external_payment_declarations
  set state = 'CONTESTED', counterpart_reason = clean_reason, updated_at = event_time
  where id = target_declaration_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, reason, created_at
  ) values (
    declaration.job_id, caller_id, 'JOB_EXTERNAL_PAYMENT_CONTESTED',
    clean_reason, event_time
  );

  return 'CONTESTED';
end;
$$;


