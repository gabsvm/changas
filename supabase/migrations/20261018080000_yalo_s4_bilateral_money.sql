-- YALO S4: dinero bilateral con pagos OFF (SPEC 7.2/7.3).
-- Nuevos objetos de declaracion externa: el cliente o el prestador
-- declara lo pagado/recibido, la contraparte confirma o contesta, y el
-- historial nunca se sobrescribe (void + supersede). YALO no verifica
-- bancariamente ni procesa esos fondos. Append-only.

create type public.external_payment_state as enum (
  'DECLARED_BY_CLIENT',
  'DECLARED_BY_PROVIDER',
  'CONFIRMED_BY_BOTH',
  'CONTESTED',
  'VOIDED'
);

create table public.external_payment_declarations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  declared_by_user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null default 'ARS' check (char_length(btrim(currency_code)) = 3),
  method text not null check (method in ('EFECTIVO', 'TRANSFERENCIA', 'OTRO_ACORDADO')),
  paid_on date null,
  reference text null check (reference is null or char_length(btrim(reference)) between 1 and 140),
  state public.external_payment_state not null default 'DECLARED_BY_CLIENT',
  counterpart_reason text null check (counterpart_reason is null or char_length(btrim(counterpart_reason)) between 1 and 1000),
  idempotency_key uuid null,
  supersedes_id uuid null references public.external_payment_declarations(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.external_payment_declarations is 'Bilateral external money registry. YALO neither verifies bank transfers nor moves these funds.';
comment on column public.external_payment_declarations.reference is 'Optional free reference. Never bank credentials; keep it minimal.';

create unique index if not exists external_payment_idempotency_uniq
  on public.external_payment_declarations (job_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists external_payment_job_state_idx
  on public.external_payment_declarations (job_id, state);

alter table public.external_payment_declarations enable row level security;

-- Lectura: solo las partes del trabajo (service_role sin restriccion).
drop policy if exists external_payment_select_parties on public.external_payment_declarations;

create policy external_payment_select_parties
on public.external_payment_declarations
for select
to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = external_payment_declarations.job_id
      and (j.client_user_id = auth.uid() or j.provider_user_id = auth.uid())
  )
);

-- Escrituras solo via RPC (definer); sin grants directos.
revoke all privileges on table public.external_payment_declarations from public, anon, authenticated;

grant select on table public.external_payment_declarations to authenticated;
grant select, insert, update on table public.external_payment_declarations to service_role;

-- Monto contractual: base + adicionales aceptados, ya sean PAID
-- o pendientes de liquidacion (AWAITING_PAYMENT/PAYMENT_FAILED).
-- El pago externo no debe depender de Mercado Pago ni excluir extras acordados.
create or replace function public.external_agreed_total_for_job(target_job_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.jobs%rowtype;
begin
  select * into target_job from public.jobs where id = target_job_id;
  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;

  -- Sin fila de versión (inasequible con FK NOT NULL, pero barato):
  -- total 0 para que los topes filtren en vez de dejar pasar NULL.
  return coalesce((
    select coalesce(pv.price_amount, 0)
      + public.paid_scope_additional_for_job(target_job.id)
      + public.unpaid_scope_additional_for_job(target_job.id)
    from public.proposal_versions pv
    where pv.id = target_job.accepted_proposal_version_id
  ), 0);
end;
$$;

revoke all on function public.external_agreed_total_for_job(uuid)
from public, anon, authenticated, service_role;

-- Helper SECURITY DEFINER no valida pertenencia: jamas exponerlo por RPC
-- autenticado. Se invoca exclusivamente dentro de RPCs con ownership check.
grant execute on function public.external_agreed_total_for_job(uuid)
to service_role;

-- Ledger bilateral: agreed / confirmed / claimed / outstanding.
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

  select coalesce(sum(d.amount_minor), 0) into confirmed
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

revoke all on function public.external_payment_ledger(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.external_payment_ledger(uuid)
to authenticated, service_role;

-- Declarar dinero externo (quien paga o quien recibe). Solo en COMPLETED.
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
  agreed bigint;
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

  agreed := public.external_agreed_total_for_job(target_job_id);
  if declared_amount_minor > agreed then
    raise exception using errcode = '22023', message = 'declared amount exceeds the agreed total';
  end if;

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

revoke all on function public.declare_external_payment(uuid, bigint, text, date, text, uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.declare_external_payment(uuid, bigint, text, date, text, uuid, uuid)
to authenticated, service_role;

-- Responder a una declaracion: solo la contraparte. Aceptar confirma de a
-- ambos (con tope acordado); contestar congela el cierre financiero y abre
-- via a soporte. El trabajo COMPLETED no se revierte.
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

  select * into target_job from public.jobs where id = declaration.job_id;
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
    select coalesce(sum(d.amount_minor), 0) into confirmed
    from public.external_payment_declarations d
    where d.job_id = declaration.job_id
      and d.state = 'CONFIRMED_BY_BOTH';

    if confirmed + declaration.amount_minor > agreed then
      raise exception using errcode = '22023', message = 'confirmed amount exceeds the agreed total';
    end if;

    update public.external_payment_declarations
    set state = 'CONFIRMED_BY_BOTH', updated_at = event_time
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

revoke all on function public.respond_external_payment(uuid, boolean, text)
from public, anon, authenticated, service_role;

grant execute on function public.respond_external_payment(uuid, boolean, text)
to authenticated, service_role;

-- Anular una declaracion propia pendiente (correccion = void + nueva).
create or replace function public.void_external_payment(
  target_declaration_id uuid
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
  event_time timestamptz := timezone('utc', now());
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

  select * into target_job from public.jobs where id = declaration.job_id;
  if target_job.id is null or caller_id not in (target_job.client_user_id, target_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  -- Congelado fuera de COMPLETED, igual que responder (ver arriba).
  if target_job.status <> 'COMPLETED' then
    raise exception using errcode = '22023', message = 'external money is registered only on completed jobs';
  end if;

  if caller_id <> declaration.declared_by_user_id then
    raise exception using errcode = '42501', message = 'only the declarer voids a declaration';
  end if;

  if declaration.state not in ('DECLARED_BY_CLIENT', 'DECLARED_BY_PROVIDER') then
    raise exception using errcode = '40001', message = 'declaration already resolved; refresh and retry';
  end if;

  update public.external_payment_declarations
  set state = 'VOIDED', updated_at = event_time
  where id = target_declaration_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, created_at
  ) values (
    declaration.job_id, caller_id, 'JOB_EXTERNAL_PAYMENT_VOIDED', event_time
  );

  return 'VOIDED';
end;
$$;

revoke all on function public.void_external_payment(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.void_external_payment(uuid)
to authenticated, service_role;
