-- Phase 06: align temporary fixed-slot holds with durable payment outcomes.
-- PENDING keeps the hold alive, FAILED releases the matching hold, and SUCCEEDED
-- remains consumed atomically by initialize_job_schedule() when the Job is created.

create or replace function public.apply_payment_result(
  target_proposal_id uuid,
  payment_nonce uuid,
  payment_provider_name text,
  payment_provider_reference text,
  payment_result_status public.payment_status,
  actor_client_user_id uuid
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
  target_proposal public.proposals%rowtype;
  accepted_version public.proposal_versions%rowtype;
  existing_attempt public.payment_attempts%rowtype;
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_provider_reference text := btrim(payment_provider_reference);
  created_attempt_id uuid;
  created_job_id uuid;
  released_hold_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment result is server-only';
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
    raise exception using errcode = '22023', message = 'payment result status is invalid';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if actor_client_user_id is null or actor_client_user_id <> target_proposal.client_user_id then
    raise exception using errcode = '42501', message = 'only the proposal client can initiate payment';
  end if;

  if target_proposal.accepted_version_id is null then
    raise exception using errcode = '42501', message = 'proposal has no accepted economic snapshot';
  end if;

  select * into accepted_version
  from public.proposal_versions
  where id = target_proposal.accepted_version_id;

  if accepted_version.price_amount is null or accepted_version.price_amount <= 0 then
    raise exception using errcode = '22023', message = 'accepted proposal has no payable amount';
  end if;

  select * into existing_attempt
  from public.payment_attempts
  where proposal_id = target_proposal_id
    and request_nonce = payment_nonce;

  if existing_attempt.id is not null then
    if existing_attempt.provider_name <> normalized_provider_name
      or existing_attempt.provider_reference <> normalized_provider_reference then
      raise exception using errcode = '23505', message = 'payment nonce is already bound to another provider result';
    end if;

    select j.id into created_job_id
    from public.jobs j
    where j.accepted_proposal_version_id = target_proposal.accepted_version_id;

    return query
    select existing_attempt.id, target_proposal.status, created_job_id;
    return;
  end if;

  if target_proposal.status = 'PAID' then
    select j.id into created_job_id
    from public.jobs j
    where j.accepted_proposal_version_id = target_proposal.accepted_version_id;

    return query
    select null::uuid, target_proposal.status, created_job_id;
    return;
  end if;

  if target_proposal.status not in ('AWAITING_PAYMENT', 'PAYMENT_FAILED') then
    raise exception using errcode = '42501', message = 'proposal is not payable';
  end if;

  if target_proposal.status = 'PAYMENT_FAILED' then
    update public.proposals
    set status = 'AWAITING_PAYMENT', updated_at = event_time
    where id = target_proposal_id;
  end if;

  insert into public.payment_attempts (
    proposal_id,
    accepted_proposal_version_id,
    request_nonce,
    provider_name,
    provider_reference,
    status,
    amount_minor,
    currency_code,
    created_at,
    updated_at
  ) values (
    target_proposal_id,
    target_proposal.accepted_version_id,
    payment_nonce,
    normalized_provider_name,
    normalized_provider_reference,
    payment_result_status,
    accepted_version.price_amount,
    accepted_version.currency_code,
    event_time,
    event_time
  )
  returning id into created_attempt_id;

  if payment_result_status = 'SUCCEEDED' then
    update public.proposals
    set status = 'PAID', updated_at = event_time
    where id = target_proposal_id;

    insert into public.jobs (
      conversation_id,
      service_id,
      client_user_id,
      provider_user_id,
      accepted_proposal_version_id,
      payment_attempt_id,
      status,
      confirmed_at,
      created_at,
      updated_at
    ) values (
      target_proposal.conversation_id,
      target_proposal.service_id,
      target_proposal.client_user_id,
      target_proposal.provider_user_id,
      target_proposal.accepted_version_id,
      created_attempt_id,
      'CONFIRMED',
      event_time,
      event_time,
      event_time
    )
    on conflict (accepted_proposal_version_id)
    do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id
    returning id into created_job_id;

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_proposal.conversation_id,
      null,
      'SYSTEM',
      'Pago aprobado. Trabajo confirmado.',
      event_time
    );
  elsif payment_result_status = 'FAILED' then
    update public.proposals
    set status = 'PAYMENT_FAILED', updated_at = event_time
    where id = target_proposal_id;

    update public.provider_slot_holds
    set released_at = event_time,
        updated_at = event_time
    where proposal_id = target_proposal_id
      and request_nonce = payment_nonce
      and released_at is null
    returning id into released_hold_id;

    if released_hold_id is not null then
      insert into public.proposal_events (
        proposal_id,
        proposal_version_id,
        actor_user_id,
        event_type,
        metadata,
        created_at
      ) values (
        target_proposal_id,
        target_proposal.accepted_version_id,
        actor_client_user_id,
        'PAYMENT_SLOT_RELEASED',
        jsonb_build_object(
          'slot_hold_id', released_hold_id,
          'payment_attempt_id', created_attempt_id,
          'reason', 'PAYMENT_FAILED'
        ),
        event_time
      );
    end if;

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_proposal.conversation_id,
      null,
      'SYSTEM',
      'El pago falló. Podés volver a intentarlo.',
      event_time
    );
  end if;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_proposal_id,
    target_proposal.accepted_version_id,
    actor_client_user_id,
    case payment_result_status
      when 'SUCCEEDED' then 'PAYMENT_SUCCEEDED'
      when 'FAILED' then 'PAYMENT_FAILED'
      else 'PAYMENT_PENDING'
    end,
    jsonb_build_object(
      'payment_attempt_id', created_attempt_id,
      'provider_name', normalized_provider_name,
      'provider_reference', normalized_provider_reference
    ),
    event_time
  );

  update public.conversations
  set last_message_at = case
        when payment_result_status in ('SUCCEEDED', 'FAILED') then event_time
        else last_message_at
      end,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return query
  select
    created_attempt_id,
    case payment_result_status
      when 'SUCCEEDED' then 'PAID'::public.proposal_status
      when 'FAILED' then 'PAYMENT_FAILED'::public.proposal_status
      else 'AWAITING_PAYMENT'::public.proposal_status
    end,
    created_job_id;
end;
$$;

revoke all on function public.apply_payment_result(
  uuid,
  uuid,
  text,
  text,
  public.payment_status,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.apply_payment_result(
  uuid,
  uuid,
  text,
  text,
  public.payment_status,
  uuid
) to service_role;
