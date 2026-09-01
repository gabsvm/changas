-- Phase 06: provider-agnostic additional payment boundary for accepted scope changes.
-- FakePaymentProvider remains a dev/test adapter; durable economic truth stores
-- normalized provider metadata and generic payment statuses/events.

alter table public.job_additional_payment_attempts
  drop constraint if exists job_additional_payment_attempts_provider_name_check;

alter table public.job_additional_payment_attempts
  add constraint job_additional_payment_attempts_provider_name_check
  check (char_length(btrim(provider_name)) between 2 and 80);

create or replace function public.apply_additional_payment_result(
  target_scope_change_id uuid,
  payment_nonce uuid,
  payment_provider_name text,
  payment_provider_reference text,
  payment_result_status public.payment_status,
  actor_client_user_id uuid
)
returns table (
  payment_attempt_id uuid,
  resulting_scope_change_status public.job_scope_change_status
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_change public.job_scope_changes%rowtype;
  target_job public.jobs%rowtype;
  existing_attempt public.job_additional_payment_attempts%rowtype;
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_provider_reference text := btrim(payment_provider_reference);
  created_attempt_id uuid;
  next_status public.job_scope_change_status;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'additional payment result is server-only';
  end if;

  if payment_nonce is null then
    raise exception using errcode = '22023', message = 'payment nonce is required';
  end if;

  if normalized_provider_name is null
     or char_length(normalized_provider_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'payment provider name is invalid';
  end if;

  if normalized_provider_reference is null
     or char_length(normalized_provider_reference) not between 6 and 160 then
    raise exception using errcode = '22023', message = 'payment provider reference is invalid';
  end if;

  if payment_result_status not in ('PENDING', 'SUCCEEDED', 'FAILED') then
    raise exception using errcode = '22023', message = 'additional payment result status is invalid';
  end if;

  select * into target_change
  from public.job_scope_changes
  where id = target_scope_change_id
  for update;

  if target_change.id is null then
    raise exception using errcode = 'P0002', message = 'scope change not found';
  end if;

  select * into target_job
  from public.jobs
  where id = target_change.job_id;

  if actor_client_user_id is null or actor_client_user_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client can initiate additional payment';
  end if;

  if target_change.additional_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'scope change has no additional amount';
  end if;

  select * into existing_attempt
  from public.job_additional_payment_attempts
  where scope_change_id = target_scope_change_id
    and request_nonce = payment_nonce;

  if existing_attempt.id is not null then
    if existing_attempt.provider_name <> normalized_provider_name
       or existing_attempt.provider_reference <> normalized_provider_reference then
      raise exception using errcode = '23505', message = 'additional payment nonce is already bound to another provider result';
    end if;

    return query select existing_attempt.id, target_change.status;
    return;
  end if;

  if target_change.status = 'PAID' then
    return query select null::uuid, target_change.status;
    return;
  end if;

  if target_change.status not in ('AWAITING_PAYMENT', 'PAYMENT_FAILED') then
    raise exception using errcode = '42501', message = 'scope change is not payable';
  end if;

  if target_change.status = 'PAYMENT_FAILED' then
    update public.job_scope_changes
    set status = 'AWAITING_PAYMENT', updated_at = event_time
    where id = target_scope_change_id;
  end if;

  insert into public.job_additional_payment_attempts (
    scope_change_id,
    request_nonce,
    provider_name,
    provider_reference,
    status,
    amount_minor,
    currency_code,
    created_at,
    updated_at
  ) values (
    target_scope_change_id,
    payment_nonce,
    normalized_provider_name,
    normalized_provider_reference,
    payment_result_status,
    target_change.additional_amount_minor,
    target_change.currency_code,
    event_time,
    event_time
  ) returning id into created_attempt_id;

  next_status := case payment_result_status
    when 'SUCCEEDED' then 'PAID'::public.job_scope_change_status
    when 'FAILED' then 'PAYMENT_FAILED'::public.job_scope_change_status
    else 'AWAITING_PAYMENT'::public.job_scope_change_status
  end;

  update public.job_scope_changes
  set status = next_status,
      updated_at = event_time
  where id = target_scope_change_id;

  insert into public.job_events (
    job_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_job.id,
    actor_client_user_id,
    case payment_result_status
      when 'SUCCEEDED' then 'ADDITIONAL_PAYMENT_SUCCEEDED'
      when 'FAILED' then 'ADDITIONAL_PAYMENT_FAILED'
      else 'ADDITIONAL_PAYMENT_PENDING'
    end,
    jsonb_build_object(
      'scope_change_id', target_scope_change_id,
      'payment_attempt_id', created_attempt_id,
      'provider_name', normalized_provider_name,
      'provider_reference', normalized_provider_reference
    ),
    event_time
  );

  return query select created_attempt_id, next_status;
end;
$$;

revoke all on function public.apply_additional_payment_result(
  uuid,
  uuid,
  text,
  text,
  public.payment_status,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.apply_additional_payment_result(
  uuid,
  uuid,
  text,
  text,
  public.payment_status,
  uuid
) to service_role;

create or replace function public.apply_fake_additional_payment_result(
  target_scope_change_id uuid,
  payment_nonce uuid,
  payment_outcome text,
  actor_client_user_id uuid
)
returns table (
  payment_attempt_id uuid,
  resulting_scope_change_status public.job_scope_change_status
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_outcome text := upper(btrim(payment_outcome));
  mapped_status public.payment_status;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'fake additional payment result is server-only';
  end if;

  mapped_status := case normalized_outcome
    when 'SUCCESS' then 'SUCCEEDED'::public.payment_status
    when 'PENDING' then 'PENDING'::public.payment_status
    when 'FAILURE' then 'FAILED'::public.payment_status
    else null
  end;

  if mapped_status is null then
    raise exception using errcode = '22023', message = 'invalid fake additional payment outcome';
  end if;

  return query
  select *
  from public.apply_additional_payment_result(
    target_scope_change_id,
    payment_nonce,
    'FAKE',
    'fake-additional:' || payment_nonce::text,
    mapped_status,
    actor_client_user_id
  );
end;
$$;

revoke all on function public.apply_fake_additional_payment_result(uuid, uuid, text, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.apply_fake_additional_payment_result(uuid, uuid, text, uuid)
to service_role;
