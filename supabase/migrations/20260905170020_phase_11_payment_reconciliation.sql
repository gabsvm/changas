-- Phase 11: authoritative real-provider reconciliation for proposal payments.
-- Redirect state and webhook payloads are never financial truth. The caller must
-- verify the provider resource server-to-server, then pass the verified result
-- through this service-role-only transaction.

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
  target_checkout public.payment_checkout_sessions%rowtype;
  target_account public.payment_provider_accounts%rowtype;
  target_proposal public.proposals%rowtype;
  accepted_version public.proposal_versions%rowtype;
  existing_attempt public.payment_attempts%rowtype;
  provider_event public.payment_provider_events%rowtype;
  normalized_provider_name text := upper(btrim(payment_provider_name));
  normalized_provider_reference text := btrim(payment_provider_reference);
  normalized_currency_code text := upper(btrim(payment_currency_code));
  normalized_account_reference text := btrim(payment_provider_account_reference);
  result_attempt_id uuid;
  result_proposal_status public.proposal_status;
  result_job_id uuid;
  released_hold_id uuid;
  event_time timestamptz := timezone('utc', now());
  ledger_metadata jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'payment reconciliation is server-only';
  end if;

  if target_checkout_session_id is null then
    raise exception using errcode = '22023', message = 'checkout session id is required';
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

  if payment_amount_minor is null or payment_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'payment amount is invalid';
  end if;

  if normalized_currency_code is null or normalized_currency_code !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'payment currency is invalid';
  end if;

  if normalized_account_reference is null
    or char_length(normalized_account_reference) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'payment provider account reference is invalid';
  end if;

  select * into target_checkout
  from public.payment_checkout_sessions checkout_session
  where checkout_session.id = target_checkout_session_id
  for update;

  if target_checkout.id is null then
    raise exception using errcode = 'P0002', message = 'payment checkout session not found';
  end if;

  if target_checkout.purpose <> 'PROPOSAL' or target_checkout.proposal_id is null then
    raise exception using errcode = '22023', message = 'checkout is not a proposal payment';
  end if;

  if upper(target_checkout.provider_name) <> normalized_provider_name then
    raise exception using errcode = '42501', message = 'payment provider does not match checkout';
  end if;

  -- Validate provider-reported economics before checking terminal replay. This
  -- ensures a spoofed replay cannot hide behind an already-terminal local row.
  if target_checkout.amount_minor <> payment_amount_minor then
    raise exception using errcode = '22023', message = 'provider amount does not match checkout truth';
  end if;

  if target_checkout.currency_code <> normalized_currency_code then
    raise exception using errcode = '22023', message = 'provider currency does not match checkout truth';
  end if;

  select * into target_account
  from public.payment_provider_accounts account
  where account.id = target_checkout.payment_provider_account_id
  for update;

  if target_account.id is null
    or target_account.provider_user_id <> target_checkout.provider_user_id
    or upper(target_account.provider_name) <> normalized_provider_name
    or target_account.provider_account_reference <> normalized_account_reference then
    raise exception using errcode = '42501', message = 'payment was not verified against the checkout seller account';
  end if;

  if source_provider_event_id is not null then
    select * into provider_event
    from public.payment_provider_events payment_event
    where payment_event.id = source_provider_event_id
    for update;

    if provider_event.id is null then
      raise exception using errcode = 'P0002', message = 'payment provider event not found';
    end if;

    if upper(provider_event.provider_name) <> normalized_provider_name
      or not provider_event.signature_valid then
      raise exception using errcode = '42501', message = 'payment provider event is not trusted for this provider';
    end if;
  end if;

  select * into target_proposal
  from public.proposals proposal
  where proposal.id = target_checkout.proposal_id
  for update;

  if target_proposal.id is null then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  if target_proposal.client_user_id <> target_checkout.client_user_id
    or target_proposal.provider_user_id <> target_checkout.provider_user_id
    or target_proposal.accepted_version_id is null then
    raise exception using errcode = '42501', message = 'checkout ownership does not match accepted proposal';
  end if;

  select * into accepted_version
  from public.proposal_versions proposal_version
  where proposal_version.id = target_proposal.accepted_version_id;

  if accepted_version.id is null
    or accepted_version.price_amount is null
    or accepted_version.price_amount <> target_checkout.amount_minor
    or accepted_version.currency_code <> target_checkout.currency_code then
    raise exception using errcode = '22023', message = 'checkout economics do not match accepted proposal snapshot';
  end if;

  select * into existing_attempt
  from public.payment_attempts attempt
  where attempt.proposal_id = target_proposal.id
    and attempt.request_nonce = target_checkout.request_nonce
  for update;

  if existing_attempt.id is not null then
    if existing_attempt.provider_name <> normalized_provider_name
      or existing_attempt.provider_reference <> normalized_provider_reference
      or existing_attempt.amount_minor <> target_checkout.amount_minor
      or existing_attempt.currency_code <> target_checkout.currency_code
      or existing_attempt.accepted_proposal_version_id <> target_proposal.accepted_version_id then
      raise exception using errcode = '23505', message = 'checkout payment identity is already bound to different financial data';
    end if;

    if existing_attempt.status in ('SUCCEEDED', 'FAILED') then
      if existing_attempt.status <> payment_result_status then
        raise exception using errcode = '40001', message = 'terminal payment state contradicts provider reconciliation';
      end if;

      result_attempt_id := existing_attempt.id;

      if existing_attempt.status = 'SUCCEEDED' then
        update public.proposals
        set status = 'PAID', updated_at = event_time
        where id = target_proposal.id
          and status <> 'PAID';

        select job.id into result_job_id
        from public.jobs job
        where job.accepted_proposal_version_id = target_proposal.accepted_version_id;

        if result_job_id is null then
          raise exception using errcode = '40001', message = 'successful payment is missing its confirmed job';
        end if;

        update public.payment_checkout_sessions
        set status = 'COMPLETED', updated_at = event_time
        where id = target_checkout.id
          and status <> 'COMPLETED';

        result_proposal_status := 'PAID';
      else
        if exists (
          select 1 from public.jobs job
          where job.accepted_proposal_version_id = target_proposal.accepted_version_id
        ) then
          raise exception using errcode = '40001', message = 'failed payment cannot own a confirmed job';
        end if;

        update public.proposals
        set status = 'PAYMENT_FAILED', updated_at = event_time
        where id = target_proposal.id
          and status <> 'PAYMENT_FAILED';

        update public.payment_checkout_sessions
        set status = 'FAILED', updated_at = event_time
        where id = target_checkout.id
          and status <> 'FAILED';

        result_proposal_status := 'PAYMENT_FAILED';
      end if;
    elsif existing_attempt.status = 'PENDING' then
      result_attempt_id := existing_attempt.id;

      if payment_result_status = 'PENDING' then
        result_proposal_status := target_proposal.status;
      else
        if target_proposal.status <> 'AWAITING_PAYMENT' then
          raise exception using errcode = '40001', message = 'pending payment proposal state changed; refresh and reconcile';
        end if;

        update public.payment_attempts
        set status = payment_result_status,
            updated_at = event_time
        where id = existing_attempt.id;

        if payment_result_status = 'SUCCEEDED' then
          update public.proposals
          set status = 'PAID', updated_at = event_time
          where id = target_proposal.id;

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
            existing_attempt.id,
            'CONFIRMED',
            event_time,
            event_time,
            event_time
          )
          on conflict (accepted_proposal_version_id)
          do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id
          returning id into result_job_id;

          insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
          values (
            target_proposal.conversation_id,
            null,
            'SYSTEM',
            'Pago aprobado. Trabajo confirmado.',
            event_time
          );

          result_proposal_status := 'PAID';
        else
          update public.proposals
          set status = 'PAYMENT_FAILED', updated_at = event_time
          where id = target_proposal.id;

          update public.provider_slot_holds
          set released_at = event_time,
              updated_at = event_time
          where proposal_id = target_proposal.id
            and request_nonce = target_checkout.request_nonce
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
              target_proposal.id,
              target_proposal.accepted_version_id,
              target_proposal.client_user_id,
              'PAYMENT_SLOT_RELEASED',
              jsonb_build_object(
                'slot_hold_id', released_hold_id,
                'payment_attempt_id', existing_attempt.id,
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

          result_proposal_status := 'PAYMENT_FAILED';
        end if;

        insert into public.proposal_events (
          proposal_id,
          proposal_version_id,
          actor_user_id,
          event_type,
          metadata,
          created_at
        ) values (
          target_proposal.id,
          target_proposal.accepted_version_id,
          target_proposal.client_user_id,
          case payment_result_status
            when 'SUCCEEDED' then 'PAYMENT_SUCCEEDED'
            else 'PAYMENT_FAILED'
          end,
          jsonb_build_object(
            'payment_attempt_id', existing_attempt.id,
            'provider_name', normalized_provider_name,
            'provider_reference', normalized_provider_reference,
            'source', 'PROVIDER_RECONCILIATION'
          ),
          event_time
        );

        update public.conversations
        set last_message_at = event_time,
            updated_at = event_time
        where id = target_proposal.conversation_id;
      end if;
    else
      raise exception using errcode = '40001', message = 'payment attempt is already in an incompatible terminal state';
    end if;
  else
    if target_checkout.status in ('COMPLETED', 'FAILED', 'EXPIRED') then
      raise exception using errcode = '40001', message = 'terminal checkout is missing its durable payment attempt';
    end if;

    select
      applied.payment_attempt_id,
      applied.resulting_proposal_status,
      applied.confirmed_job_id
    into
      result_attempt_id,
      result_proposal_status,
      result_job_id
    from public.apply_payment_result(
      target_proposal.id,
      target_checkout.request_nonce,
      normalized_provider_name,
      normalized_provider_reference,
      payment_result_status,
      target_checkout.client_user_id
    ) applied;
  end if;

  if payment_result_status = 'SUCCEEDED' then
    update public.payment_checkout_sessions
    set status = 'COMPLETED', updated_at = event_time
    where id = target_checkout.id
      and status <> 'COMPLETED';

    if result_job_id is null then
      select job.id into result_job_id
      from public.jobs job
      where job.accepted_proposal_version_id = target_proposal.accepted_version_id;
    end if;

    if result_job_id is null then
      raise exception using errcode = '40001', message = 'successful reconciliation did not confirm a job';
    end if;

    ledger_metadata := jsonb_build_object(
      'checkout_session_id', target_checkout.id,
      'proposal_id', target_proposal.id,
      'provider_name', normalized_provider_name
    );

    perform public.append_financial_ledger_entry(
      target_checkout.id,
      result_attempt_id,
      null,
      null,
      'GROSS_PAYMENT',
      'CLIENT',
      target_checkout.amount_minor,
      target_checkout.currency_code,
      normalized_provider_reference,
      'payment:' || target_checkout.id::text || ':gross',
      ledger_metadata
    );

    perform public.append_financial_ledger_entry(
      target_checkout.id,
      result_attempt_id,
      null,
      null,
      'MARKETPLACE_FEE',
      'MARKETPLACE',
      target_checkout.marketplace_fee_minor,
      target_checkout.currency_code,
      normalized_provider_reference,
      'payment:' || target_checkout.id::text || ':marketplace-fee',
      ledger_metadata
    );

    perform public.append_financial_ledger_entry(
      target_checkout.id,
      result_attempt_id,
      null,
      null,
      'PROVIDER_NET',
      'PROVIDER',
      target_checkout.provider_net_expected_minor,
      target_checkout.currency_code,
      normalized_provider_reference,
      'payment:' || target_checkout.id::text || ':provider-net',
      ledger_metadata
    );
  elsif payment_result_status = 'FAILED' then
    update public.payment_checkout_sessions
    set status = 'FAILED', updated_at = event_time
    where id = target_checkout.id
      and status <> 'FAILED';
  end if;

  if source_provider_event_id is not null then
    perform public.update_payment_provider_event_processing(
      source_provider_event_id,
      'PROCESSED',
      null,
      null
    );
  end if;

  return query
  select result_attempt_id, result_proposal_status, result_job_id;
end;
$$;

revoke all on function public.reconcile_provider_payment(
  uuid,
  text,
  text,
  public.payment_status,
  bigint,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.reconcile_provider_payment(
  uuid,
  text,
  text,
  public.payment_status,
  bigint,
  text,
  text,
  uuid
) to service_role;
