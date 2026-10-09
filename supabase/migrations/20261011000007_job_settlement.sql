-- Cobro al cierre (hire-on-accept): el checkout de propuesta exige
-- AWAITING_PAYMENT, estado inalcanzable desde que aceptar contrata directo.
-- El cobro real ocurre al completar el trabajo: checkout PROPOSAL marcado con
-- job_id (sin tocar el enum purpose) por base + adicionales aprobados impagos.
-- El reconcile rutea por job_id a la rama settlement; DISPUTED/CANCELLED nunca
-- liquidan y lo ya pagado no se duplica.
--
-- No ALTER TYPE (no corre en transaccion): el proposito sigue PROPOSAL.

alter table public.payment_checkout_sessions
  add column if not exists job_id uuid references public.jobs(id) on delete restrict;

alter table public.payment_checkout_sessions
  add column if not exists settlement_scope_change_ids uuid[] not null default '{}';

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_settlement_check;

alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_settlement_check
  check (
    job_id is null
    or (purpose = 'PROPOSAL' and proposal_id is not null)
  );

create index if not exists payment_checkout_sessions_job_idx
on public.payment_checkout_sessions (job_id)
where job_id is not null;

create table if not exists public.job_settlement_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  request_nonce uuid not null,
  provider_name text not null check (char_length(btrim(provider_name)) between 2 and 80),
  provider_reference text not null check (char_length(provider_reference) between 6 and 160),
  status public.payment_status not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  included_scope_change_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (job_id, request_nonce),
  unique (provider_name, provider_reference)
);

drop trigger if exists job_settlement_attempts_set_updated_at on public.job_settlement_attempts;
create trigger job_settlement_attempts_set_updated_at
before update on public.job_settlement_attempts
for each row execute function public.set_updated_at();

-- Un solo cobro exitoso por trabajo, tambien bajo concurrencia (el guard
-- exists() en apply no es suficiente contra dos checkouts simultaneos).
create unique index if not exists job_settlement_attempts_one_succeeded_idx
on public.job_settlement_attempts (job_id)
where status = 'SUCCEEDED';

alter table public.job_settlement_attempts enable row level security;
revoke all privileges on table public.job_settlement_attempts from public, anon, authenticated, service_role;
grant select, insert, update on table public.job_settlement_attempts to service_role;

-- Adicionales aprobados pero impagos (el cliente acepto, el pago quedo pendiente
-- o fallo). Los $0 van directo a PAID en respond, asi que todo lo incluido > 0.
create or replace function public.unpaid_scope_additional_for_job(target_job_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(sum(additional_amount_minor), 0)
  from public.job_scope_changes
  where job_id = target_job_id
    and status in ('AWAITING_PAYMENT', 'PAYMENT_FAILED');
$$;

revoke all on function public.unpaid_scope_additional_for_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.unpaid_scope_additional_for_job(uuid)
to service_role;

create or replace function public.unpaid_scope_change_ids_for_job(target_job_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(id order by id), '{}')
  from public.job_scope_changes
  where job_id = target_job_id
    and status in ('AWAITING_PAYMENT', 'PAYMENT_FAILED');
$$;

revoke all on function public.unpaid_scope_change_ids_for_job(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.unpaid_scope_change_ids_for_job(uuid)
to service_role;

create or replace function public.job_is_settled(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.job_settlement_attempts
    where job_id = target_job_id
      and status = 'SUCCEEDED'
  );
$$;

revoke all on function public.job_is_settled(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.job_is_settled(uuid)
to service_role;

-- Snapshot economico para crear el checkout de cierre (server-only). Valida
-- COMPLETED, no liquidado, moneda unica y total > 0. El ownership contra el
-- usuario lo valida la capa TS (snapshot.client_user_id).
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
  where job_id = target_job.id
    and status in ('AWAITING_PAYMENT', 'PAYMENT_FAILED');

  if exists (
    select 1 from public.job_scope_changes
    where id = any (included)
      and currency_code <> accepted_version.currency_code
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

-- Aplica el resultado del cobro al cierre. Solo COMPLETED; el set incluido debe
-- coincidir exacto con los adicionales aprobados-impagos actuales (si cambio,
-- el cliente genera un checkout nuevo). Idempotente por (job, nonce).
create or replace function public.apply_job_settlement_result(
  target_job_id uuid,
  settlement_nonce uuid,
  settlement_provider_name text,
  settlement_provider_reference text,
  settlement_result_status public.payment_status,
  settlement_actor_user_id uuid,
  included_scope_change_ids uuid[],
  assert_total_minor bigint
)
returns table (
  settlement_attempt_id uuid,
  resulting_proposal_status public.proposal_status,
  settled_job_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.jobs%rowtype;
  accepted_version public.proposal_versions%rowtype;
  target_proposal public.proposals%rowtype;
  existing_attempt public.job_settlement_attempts%rowtype;
  normalized_provider text := upper(btrim(settlement_provider_name));
  normalized_reference text := btrim(settlement_provider_reference);
  normalized_included uuid[] := coalesce(included_scope_change_ids, '{}');
  current_unpaid uuid[];
  extras_total bigint := 0;
  base_amount bigint := 0;
  expected_total bigint;
  result_attempt_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'job settlement is server-only';
  end if;

  if target_job_id is null then
    raise exception using errcode = '22023', message = 'job id is required';
  end if;
  if settlement_nonce is null then
    raise exception using errcode = '22023', message = 'settlement nonce is required';
  end if;
  if normalized_provider is null or char_length(normalized_provider) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'settlement provider name is invalid';
  end if;
  if normalized_reference is null or char_length(normalized_reference) not between 6 and 160 then
    raise exception using errcode = '22023', message = 'settlement provider reference is invalid';
  end if;
  if settlement_result_status not in ('PENDING', 'SUCCEEDED', 'FAILED') then
    raise exception using errcode = '22023', message = 'settlement result status is invalid';
  end if;

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;
  if settlement_actor_user_id is null or settlement_actor_user_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the job client settles the job';
  end if;
  if target_job.status <> 'COMPLETED' then
    raise exception using errcode = '42501', message = 'job settlement requires a completed job';
  end if;

  select * into accepted_version
  from public.proposal_versions
  where id = target_job.accepted_proposal_version_id;
  if accepted_version.id is null then
    raise exception using errcode = 'P0002', message = 'accepted proposal version not found';
  end if;
  select * into target_proposal
  from public.proposals
  where id = accepted_version.proposal_id;
  if target_proposal.id is null
    or target_proposal.client_user_id <> target_job.client_user_id
    or target_proposal.provider_user_id <> target_job.provider_user_id then
    raise exception using errcode = '42501', message = 'settlement ownership mismatch';
  end if;

  select * into existing_attempt
  from public.job_settlement_attempts
  where job_id = target_job.id and request_nonce = settlement_nonce
  for update;

  if existing_attempt.id is null
    and exists (
      select 1 from public.job_settlement_attempts
      where job_id = target_job.id and status = 'SUCCEEDED'
    ) then
    raise exception using errcode = '40001', message = 'job is already settled';
  end if;

  -- Same-nonce replay resolves against the recorded attempt, before fresh
  -- truth validation: after success the included extras are PAID, so the
  -- current unpaid set no longer matches by design.
  if existing_attempt.id is not null then
    if existing_attempt.provider_name <> normalized_provider
      or existing_attempt.provider_reference <> normalized_reference
      or existing_attempt.included_scope_change_ids <> normalized_included
      or (assert_total_minor is not null and existing_attempt.amount_minor <> assert_total_minor) then
      raise exception using errcode = '23505', message = 'settlement identity is bound to different financial data';
    end if;
    if existing_attempt.status <> 'PENDING'
      and existing_attempt.status <> settlement_result_status then
      raise exception using errcode = '40001', message = 'terminal settlement contradicts provider result';
    end if;
    if existing_attempt.status <> 'PENDING' then
      if settlement_result_status = 'SUCCEEDED' then
        update public.proposals set status = 'PAID', updated_at = event_time
        where id = target_proposal.id and status <> 'PAID';
      end if;
      return query select existing_attempt.id,
        case when settlement_result_status = 'SUCCEEDED'
          then 'PAID'::public.proposal_status
          else target_proposal.status end,
        target_job.id;
      return;
    end if;
    if settlement_result_status = 'PENDING' then
      return query select existing_attempt.id, target_proposal.status, target_job.id;
      return;
    end if;
  end if;

  select
    coalesce(array_agg(id order by id) filter (where id is not null), '{}'),
    coalesce(sum(additional_amount_minor), 0)
  into current_unpaid, extras_total
  from public.job_scope_changes
  where job_id = target_job.id
    and status in ('AWAITING_PAYMENT', 'PAYMENT_FAILED');

  if normalized_included <> current_unpaid then
    raise exception using errcode = '22023', message = 'settlement economics changed; create a new checkout';
  end if;
  if exists (
    select 1 from public.job_scope_changes
    where id = any (normalized_included)
      and currency_code <> accepted_version.currency_code
  ) then
    raise exception using errcode = '22023', message = 'settlement currency mismatch';
  end if;

  base_amount := coalesce(accepted_version.price_amount, 0);
  expected_total := base_amount + extras_total;
  if expected_total <= 0 then
    raise exception using errcode = '22023', message = 'job has no amount to settle';
  end if;
  if assert_total_minor is not null and assert_total_minor <> expected_total then
    raise exception using errcode = '22023', message = 'settlement total does not match job truth';
  end if;
  if existing_attempt.id is not null
    and existing_attempt.amount_minor <> expected_total then
    raise exception using errcode = '22023', message = 'settlement economics changed; create a new checkout';
  end if;

  if existing_attempt.id is not null then
    result_attempt_id := existing_attempt.id;
    update public.job_settlement_attempts
    set status = settlement_result_status, updated_at = event_time
    where id = result_attempt_id;
  else
    insert into public.job_settlement_attempts (
      job_id, request_nonce, provider_name, provider_reference, status,
      amount_minor, currency_code, included_scope_change_ids, created_at, updated_at
    ) values (
      target_job.id, settlement_nonce, normalized_provider, normalized_reference,
      case when settlement_result_status = 'PENDING' then 'PENDING'::public.payment_status else settlement_result_status end,
      expected_total, accepted_version.currency_code, normalized_included, event_time, event_time
    )
    returning id into result_attempt_id;
    if settlement_result_status = 'PENDING' then
      return query select result_attempt_id, target_proposal.status, target_job.id;
      return;
    end if;
  end if;

  if settlement_result_status = 'SUCCEEDED' then
    if normalized_included <> '{}' then
      update public.job_scope_changes
      set status = 'PAID', updated_at = event_time
      where id = any (normalized_included);
      insert into public.job_events (job_id, actor_user_id, event_type, metadata, created_at)
      values (
        target_job.id, settlement_actor_user_id, 'SETTLEMENT_ADDITIONALS_PAID',
        jsonb_build_object('scope_change_ids', normalized_included,
          'settlement_attempt_id', result_attempt_id,
          'provider_name', normalized_provider,
          'provider_reference', normalized_reference),
        event_time
      );
    end if;

    update public.proposals
    set status = 'PAID', updated_at = event_time
    where id = target_proposal.id and status <> 'PAID';

    insert into public.proposal_events (
      proposal_id, proposal_version_id, actor_user_id, event_type, metadata, created_at
    ) values (
      target_proposal.id, target_proposal.accepted_version_id, settlement_actor_user_id,
      'SETTLEMENT_SUCCEEDED',
      jsonb_build_object('job_id', target_job.id,
        'settlement_attempt_id', result_attempt_id,
        'provider_name', normalized_provider,
        'provider_reference', normalized_reference,
        'source', 'JOB_SETTLEMENT'),
      event_time
    );

    insert into public.job_events (job_id, actor_user_id, event_type, metadata, created_at)
    values (
      target_job.id, settlement_actor_user_id, 'JOB_SETTLEMENT_SUCCEEDED',
      jsonb_build_object('settlement_attempt_id', result_attempt_id,
        'amount_minor', expected_total, 'currency_code', accepted_version.currency_code,
        'provider_name', normalized_provider, 'provider_reference', normalized_reference),
      event_time
    );

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id, null, 'SYSTEM',
      'Pago del trabajo acreditado. ¡Gracias!', event_time
    );
    update public.conversations
    set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;

    return query select result_attempt_id, 'PAID'::public.proposal_status, target_job.id;
    return;
  end if;

  insert into public.job_events (job_id, actor_user_id, event_type, metadata, created_at)
  values (
    target_job.id, settlement_actor_user_id, 'JOB_SETTLEMENT_FAILED',
    jsonb_build_object('settlement_attempt_id', result_attempt_id,
      'provider_name', normalized_provider, 'provider_reference', normalized_reference),
    event_time
  );
  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_job.conversation_id, null, 'SYSTEM',
    'El pago del trabajo falló. Podés volver a intentarlo.', event_time
  );
  update public.conversations
  set last_message_at = event_time, updated_at = event_time
  where id = target_job.conversation_id;

  return query select result_attempt_id, target_proposal.status, target_job.id;
end;
$$;

revoke all on function public.apply_job_settlement_result(uuid, uuid, text, text, public.payment_status, uuid, uuid[], bigint)
from public, anon, authenticated, service_role;
grant execute on function public.apply_job_settlement_result(uuid, uuid, text, text, public.payment_status, uuid, uuid[], bigint)
to service_role;

-- Conciliacion del cobro al cierre: valida checkout/cuenta/evento y delega la
-- transicion a apply_job_settlement_result. Reusa tipos de ledger existentes
-- (es el cobro bruto, cobrado tarde) con llaves settlement:*.
create or replace function public.reconcile_job_settlement_payment(
  target_checkout_session_id uuid,
  payment_provider_name text,
  payment_provider_reference text,
  payment_result_status public.payment_status,
  payment_amount_minor bigint,
  payment_currency_code text,
  payment_provider_account_reference text,
  source_provider_event_id uuid default null
)
returns table (
  payment_attempt_id uuid,
  resulting_proposal_status public.proposal_status,
  confirmed_job_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  checkout public.payment_checkout_sessions%rowtype;
  account public.payment_provider_accounts%rowtype;
  provider_event public.payment_provider_events%rowtype;
  result_attempt_id uuid;
  result_proposal_status public.proposal_status;
  result_job_id uuid;
  event_time timestamptz := timezone('utc', now());
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_reference text := btrim(payment_provider_reference);
  normalized_currency text := upper(btrim(payment_currency_code));
  normalized_account_reference text := btrim(payment_provider_account_reference);
  ledger_metadata jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation is server-only';
  end if;

  select * into checkout from public.payment_checkout_sessions where id = target_checkout_session_id for update;
  if checkout.id is null then raise exception using errcode = 'P0002', message = 'payment checkout session not found'; end if;
  if checkout.job_id is null then
    raise exception using errcode = '22023', message = 'checkout is not a job settlement';
  end if;
  if payment_result_status not in ('PENDING', 'SUCCEEDED', 'FAILED') then
    raise exception using errcode = '22023', message = 'settlement result status is invalid';
  end if;
  if checkout.provider_name <> normalized_provider_name
    or checkout.amount_minor <> payment_amount_minor
    or checkout.currency_code <> normalized_currency then
    raise exception using errcode = '22023', message = 'provider payment does not match settlement checkout truth';
  end if;

  select * into account from public.payment_provider_accounts where id = checkout.payment_provider_account_id for update;
  if account.id is null
    or account.provider_user_id <> checkout.provider_user_id
    or account.provider_name <> normalized_provider_name
    or account.provider_account_reference <> normalized_account_reference then
    raise exception using errcode = '42501', message = 'settlement seller account mismatch';
  end if;

  if source_provider_event_id is not null then
    select * into provider_event from public.payment_provider_events where id = source_provider_event_id for update;
    if provider_event.id is null or provider_event.provider_name <> normalized_provider_name or not provider_event.signature_valid then
      raise exception using errcode = '42501', message = 'payment provider event is not trusted';
    end if;
  end if;

  select applied_row.settlement_attempt_id, applied_row.resulting_proposal_status, applied_row.settled_job_id
  into result_attempt_id, result_proposal_status, result_job_id
  from public.apply_job_settlement_result(
    checkout.job_id, checkout.request_nonce, normalized_provider_name,
    normalized_reference, payment_result_status, checkout.client_user_id,
    checkout.settlement_scope_change_ids, checkout.amount_minor
  ) applied_row;

  if payment_result_status = 'SUCCEEDED' then
    update public.payment_checkout_sessions set status = 'COMPLETED', updated_at = event_time where id = checkout.id;
    ledger_metadata := jsonb_build_object('kind', 'JOB_SETTLEMENT',
      'checkout_session_id', checkout.id, 'job_id', result_job_id,
      'settlement_attempt_id', result_attempt_id,
      'provider_name', normalized_provider_name);

    perform public.append_financial_ledger_entry(checkout.id, null, null, source_provider_event_id,
      'GROSS_PAYMENT', 'CLIENT', checkout.amount_minor, checkout.currency_code, normalized_reference,
      'settlement:' || checkout.id::text || ':gross', ledger_metadata);
    perform public.append_financial_ledger_entry(checkout.id, null, null, source_provider_event_id,
      'MARKETPLACE_FEE', 'MARKETPLACE', checkout.marketplace_fee_minor, checkout.currency_code, normalized_reference,
      'settlement:' || checkout.id::text || ':marketplace-fee', ledger_metadata);
    perform public.append_financial_ledger_entry(checkout.id, null, null, source_provider_event_id,
      'PROVIDER_NET', 'PROVIDER', checkout.provider_net_expected_minor, checkout.currency_code, normalized_reference,
      'settlement:' || checkout.id::text || ':provider-net', ledger_metadata);
  elsif payment_result_status = 'FAILED' then
    update public.payment_checkout_sessions set status = 'FAILED', updated_at = event_time where id = checkout.id;
  end if;

  if source_provider_event_id is not null then
    perform public.update_payment_provider_event_processing(source_provider_event_id, 'PROCESSED', null, null);
  end if;

  return query select result_attempt_id, result_proposal_status, result_job_id;
end;
$$;

revoke all on function public.reconcile_job_settlement_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.reconcile_job_settlement_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid)
to service_role;

-- Dispatcher: los checkouts con job_id van a la rama settlement. Resto identico.
create or replace function public.reconcile_provider_payment(
  target_checkout_session_id uuid,
  payment_provider_name text,
  payment_provider_reference text,
  payment_result_status public.payment_status,
  payment_amount_minor bigint,
  payment_currency_code text,
  payment_provider_account_reference text,
  source_provider_event_id uuid default null
)
returns table (
  payment_attempt_id uuid,
  resulting_proposal_status public.proposal_status,
  confirmed_job_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  checkout public.payment_checkout_sessions%rowtype;
  account public.payment_provider_accounts%rowtype;
  provider_event public.payment_provider_events%rowtype;
  change public.job_scope_changes%rowtype;
  target_job public.jobs%rowtype;
  attempt public.job_additional_payment_attempts%rowtype;
  result_attempt_id uuid;
  event_time timestamptz := timezone('utc', now());
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_reference text := btrim(payment_provider_reference);
  normalized_currency text := upper(btrim(payment_currency_code));
  normalized_account_reference text := btrim(payment_provider_account_reference);
  ledger_metadata jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation is server-only';
  end if;

  select * into checkout from public.payment_checkout_sessions where id = target_checkout_session_id for update;
  if checkout.id is null then raise exception using errcode = 'P0002', message = 'payment checkout session not found'; end if;

  if checkout.job_id is not null then
    return query
    select * from public.reconcile_job_settlement_payment(
      target_checkout_session_id, payment_provider_name, payment_provider_reference,
      payment_result_status, payment_amount_minor, payment_currency_code,
      payment_provider_account_reference, source_provider_event_id
    );
    return;
  end if;

  if checkout.purpose = 'PROPOSAL' then
    return query
    select * from public.reconcile_provider_proposal_payment(
      target_checkout_session_id, payment_provider_name, payment_provider_reference,
      payment_result_status, payment_amount_minor, payment_currency_code,
      payment_provider_account_reference, source_provider_event_id
    );
    return;
  end if;

  if checkout.purpose <> 'SCOPE_CHANGE' or checkout.scope_change_id is null then
    raise exception using errcode = '22023', message = 'unsupported payment checkout purpose';
  end if;
  if payment_result_status not in ('PENDING', 'SUCCEEDED', 'FAILED') then
    raise exception using errcode = '22023', message = 'additional payment result status is invalid';
  end if;
  if checkout.provider_name <> normalized_provider_name
    or checkout.amount_minor <> payment_amount_minor
    or checkout.currency_code <> normalized_currency then
    raise exception using errcode = '22023', message = 'provider payment does not match additional checkout truth';
  end if;

  select * into account from public.payment_provider_accounts where id = checkout.payment_provider_account_id for update;
  if account.id is null
    or account.provider_user_id <> checkout.provider_user_id
    or account.provider_name <> normalized_provider_name
    or account.provider_account_reference <> normalized_account_reference then
    raise exception using errcode = '42501', message = 'additional payment seller account mismatch';
  end if;

  if source_provider_event_id is not null then
    select * into provider_event from public.payment_provider_events where id = source_provider_event_id for update;
    if provider_event.id is null or provider_event.provider_name <> normalized_provider_name or not provider_event.signature_valid then
      raise exception using errcode = '42501', message = 'payment provider event is not trusted';
    end if;
  end if;

  select * into change from public.job_scope_changes where id = checkout.scope_change_id for update;
  if change.id is null then raise exception using errcode = 'P0002', message = 'scope change not found'; end if;
  select * into target_job from public.jobs where id = change.job_id for update;
  if target_job.id is null
    or target_job.client_user_id <> checkout.client_user_id
    or target_job.provider_user_id <> checkout.provider_user_id
    or change.additional_amount_minor <> checkout.amount_minor
    or change.currency_code <> checkout.currency_code then
    raise exception using errcode = '42501', message = 'additional checkout ownership or economics mismatch';
  end if;

  select * into attempt
  from public.job_additional_payment_attempts
  where scope_change_id = change.id and request_nonce = checkout.request_nonce
  for update;

  if attempt.id is null then
    select applied.payment_attempt_id into result_attempt_id
    from public.apply_additional_payment_result(
      change.id, checkout.request_nonce, normalized_provider_name,
      normalized_reference, payment_result_status, checkout.client_user_id
    ) applied;
    select * into attempt from public.job_additional_payment_attempts where id = result_attempt_id;
  else
    if attempt.provider_name <> normalized_provider_name
      or attempt.provider_reference <> normalized_reference
      or attempt.amount_minor <> checkout.amount_minor
      or attempt.currency_code <> checkout.currency_code then
      raise exception using errcode = '23505', message = 'additional payment identity is bound to different financial data';
    end if;

    result_attempt_id := attempt.id;
    if attempt.status in ('SUCCEEDED', 'FAILED') then
      if attempt.status <> payment_result_status then
        raise exception using errcode = '40001', message = 'terminal additional payment contradicts provider reconciliation';
      end if;
    elsif attempt.status = 'PENDING' then
      if payment_result_status <> 'PENDING' then
        update public.job_additional_payment_attempts
        set status = payment_result_status, updated_at = event_time
        where id = attempt.id;

        update public.job_scope_changes
        set status = case payment_result_status
          when 'SUCCEEDED' then 'PAID'::public.job_scope_change_status
          else 'PAYMENT_FAILED'::public.job_scope_change_status
        end,
        updated_at = event_time
        where id = change.id;

        insert into public.job_events(job_id, actor_user_id, event_type, metadata, created_at)
        values (
          target_job.id, checkout.client_user_id,
          case payment_result_status when 'SUCCEEDED' then 'ADDITIONAL_PAYMENT_SUCCEEDED' else 'ADDITIONAL_PAYMENT_FAILED' end,
          jsonb_build_object('scope_change_id', change.id, 'payment_attempt_id', attempt.id,
            'provider_name', normalized_provider_name, 'provider_reference', normalized_reference,
            'source', 'PROVIDER_RECONCILIATION'),
          event_time
        );
      end if;
    else
      raise exception using errcode = '40001', message = 'additional payment attempt is in incompatible state';
    end if;
  end if;

  if payment_result_status = 'SUCCEEDED' then
    update public.payment_checkout_sessions set status = 'COMPLETED', updated_at = event_time where id = checkout.id;
    ledger_metadata := jsonb_build_object('checkout_session_id', checkout.id, 'scope_change_id', change.id,
      'job_id', target_job.id, 'provider_name', normalized_provider_name);

    perform public.append_financial_ledger_entry(checkout.id, null, result_attempt_id, source_provider_event_id,
      'ADDITIONAL_CHARGE', 'CLIENT', checkout.amount_minor, checkout.currency_code, normalized_reference,
      'additional:' || checkout.id::text || ':gross', ledger_metadata);
    perform public.append_financial_ledger_entry(checkout.id, null, result_attempt_id, source_provider_event_id,
      'MARKETPLACE_FEE', 'MARKETPLACE', checkout.marketplace_fee_minor, checkout.currency_code, normalized_reference,
      'additional:' || checkout.id::text || ':marketplace-fee', ledger_metadata);
    perform public.append_financial_ledger_entry(checkout.id, null, result_attempt_id, source_provider_event_id,
      'PROVIDER_NET', 'PROVIDER', checkout.provider_net_expected_minor, checkout.currency_code, normalized_reference,
      'additional:' || checkout.id::text || ':provider-net', ledger_metadata);
  elsif payment_result_status = 'FAILED' then
    update public.payment_checkout_sessions set status = 'FAILED', updated_at = event_time where id = checkout.id;
  end if;

  if source_provider_event_id is not null then
    perform public.update_payment_provider_event_processing(source_provider_event_id, 'PROCESSED', null, null);
  end if;

  return query select result_attempt_id, null::public.proposal_status, target_job.id;
end;
$$;

revoke all on function public.reconcile_provider_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_provider_payment(uuid, text, text, public.payment_status, bigint, text, text, uuid) to service_role;

-- Read models: exponen el estado del cobro al cierre.
-- settlement_status: NOT_DUE (no COMPLETED) | DUE | SETTLED | NOT_REQUIRED (total 0).
drop function if exists public.get_job_detail(uuid);

create or replace function public.get_job_detail(target_job_id uuid)
returns table (
  job_id uuid,
  conversation_id uuid,
  job_status public.job_status,
  client_user_id uuid,
  provider_user_id uuid,
  service_id uuid,
  service_title text,
  scope_snapshot text,
  base_price_amount bigint,
  currency_code text,
  modality public.service_modality,
  schedule_type public.schedule_type,
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  schedule_deadline_at timestamptz,
  expected_duration_minutes integer,
  counterparty_name text,
  exact_address text,
  exact_latitude double precision,
  exact_longitude double precision,
  access_notes text,
  confirmed_at timestamptz,
  updated_at timestamptz,
  paid_additional_amount bigint,
  total_price_amount bigint,
  settlement_status text,
  settlement_total_minor bigint,
  settlement_unpaid_extras_minor bigint,
  settlement_unpaid_extra_ids uuid[]
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

  if not exists (
    select 1
    from public.jobs j
    where j.id = target_job_id
      and caller_id in (j.client_user_id, j.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'job access denied';
  end if;

  return query
  select
    j.id,
    j.conversation_id,
    j.status,
    j.client_user_id,
    j.provider_user_id,
    j.service_id,
    pv.service_title_snapshot,
    pv.scope_snapshot,
    pv.price_amount,
    pv.currency_code,
    pv.modality,
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    sv.expected_duration_minutes,
    coalesce(peer.display_name, 'Usuario'),
    case when public.can_view_job_exact_location(j.id) then loc.exact_address end,
    case when public.can_view_job_exact_location(j.id) then loc.latitude end,
    case when public.can_view_job_exact_location(j.id) then loc.longitude end,
    case when public.can_view_job_exact_location(j.id) then loc.access_notes end,
    j.confirmed_at,
    j.updated_at,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount + public.paid_scope_additional_for_job(j.id),
    case
      when j.status <> 'COMPLETED' then 'NOT_DUE'
      when public.job_is_settled(j.id) then 'SETTLED'
      when coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id) <= 0 then 'NOT_REQUIRED'
      else 'DUE'
    end,
    coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id),
    public.unpaid_scope_additional_for_job(j.id),
    public.unpaid_scope_change_ids_for_job(j.id)
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  left join public.job_private_locations loc on loc.job_id = j.id
  where j.id = target_job_id;
end;
$$;

revoke all on function public.get_job_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_detail(uuid)
to authenticated, service_role;

drop function if exists public.list_my_past_jobs(integer);

create or replace function public.list_my_past_jobs(limit_count integer default 20)
returns table (
  job_id uuid,
  job_status public.job_status,
  service_title text,
  counterparty_name text,
  schedule_type public.schedule_type,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  updated_at timestamptz,
  base_price_amount bigint,
  currency_code text,
  is_client boolean,
  paid_additional_amount bigint,
  total_price_amount bigint,
  settlement_status text,
  settlement_total_minor bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_limit integer := least(greatest(coalesce(limit_count, 20), 1), 50);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    j.id,
    j.status,
    pv.service_title_snapshot,
    coalesce(peer.display_name, 'Usuario'),
    sv.schedule_type,
    sv.starts_at,
    sv.ends_at,
    sv.deadline_at,
    j.updated_at,
    pv.price_amount,
    pv.currency_code,
    caller_id = j.client_user_id,
    public.paid_scope_additional_for_job(j.id),
    pv.price_amount + public.paid_scope_additional_for_job(j.id),
    case
      when j.status <> 'COMPLETED' then 'NOT_DUE'
      when public.job_is_settled(j.id) then 'SETTLED'
      when coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id) <= 0 then 'NOT_REQUIRED'
      else 'DUE'
    end,
    coalesce(pv.price_amount, 0) + public.unpaid_scope_additional_for_job(j.id)
  from public.jobs j
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions sv on sv.id = j.current_schedule_version_id
  left join public.profiles peer on peer.id = case
    when caller_id = j.client_user_id then j.provider_user_id
    else j.client_user_id
  end
  where caller_id in (j.client_user_id, j.provider_user_id)
    and j.status in ('COMPLETED', 'CANCELLED', 'NO_SHOW')
  order by j.updated_at desc, j.id desc
  limit bounded_limit;
end;
$$;

revoke all on function public.list_my_past_jobs(integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_past_jobs(integer)
to authenticated, service_role;
