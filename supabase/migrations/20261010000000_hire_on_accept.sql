-- Hire-on-accept: contratar es aceptar. El trabajo nace CONFIRMED sin
-- pago por adelantado; el cobro se liquida al cierre (sin reclamo) o no se
-- cobra (con reclamo). Generado desde 20260901050000_phase_05_proposals.sql.

-- Los trabajos ya no exigen intento de pago al nacer.
alter table public.jobs alter column payment_attempt_id drop not null;


create or replace function public.create_conversation_proposal(
  target_conversation_id uuid,
  requested_kind public.proposal_kind,
  scope_text text default null,
  proposed_price_amount bigint default null,
  proposed_schedule_start_at timestamptz default null,
  proposed_schedule_end_at timestamptz default null,
  proposed_deadline_at timestamptz default null,
  proposal_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_service_id uuid;
  target_client_id uuid;
  target_provider_id uuid;
  service_title text;
  service_description text;
  service_modality public.service_modality;
  service_price_model public.price_model;
  service_price_amount bigint;
  service_currency text;
  service_accepts_offers boolean;
  service_schedule_type public.schedule_type;
  service_duration integer;
  service_includes text;
  service_materials text;
  effective_scope text;
  effective_price bigint;
  created_proposal_id uuid;
  created_version_id uuid;
  created_status public.proposal_status := 'OPEN';
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select
    c.service_id,
    c.client_user_id,
    c.provider_user_id,
    s.title,
    s.description,
    s.modality,
    s.price_model,
    s.price_amount,
    s.currency_code,
    s.accepts_offers,
    s.schedule_type,
    s.expected_duration_minutes,
    s.includes,
    s.materials_notes
  into
    target_service_id,
    target_client_id,
    target_provider_id,
    service_title,
    service_description,
    service_modality,
    service_price_model,
    service_price_amount,
    service_currency,
    service_accepts_offers,
    service_schedule_type,
    service_duration,
    service_includes,
    service_materials
  from public.conversations c
  join public.services s on s.id = c.service_id
  where c.id = target_conversation_id
    and caller_id in (c.client_user_id, c.provider_user_id)
  limit 1;

  if target_service_id is null then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  if proposal_expires_at is not null and proposal_expires_at <= event_time then
    raise exception using errcode = '22023', message = 'proposal expiry must be in the future';
  end if;

  if proposed_schedule_end_at is not null
    and proposed_schedule_start_at is not null
    and proposed_schedule_end_at <= proposed_schedule_start_at then
    raise exception using errcode = '22023', message = 'schedule end must be after start';
  end if;

  effective_scope := coalesce(nullif(btrim(scope_text), ''), service_description);
  if char_length(effective_scope) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'proposal scope is invalid';
  end if;

  case requested_kind
    when 'DIRECT_BOOKING' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can create a direct booking';
      end if;
      if service_price_model <> 'FIXED' or service_price_amount is null then
        raise exception using errcode = '22023', message = 'direct booking requires a fixed-price service';
      end if;
      effective_price := service_price_amount;
      created_status := 'ACCEPTED';
    when 'QUOTE_REQUEST' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can request a quote';
      end if;
      if proposed_price_amount is not null then
        raise exception using errcode = '22023', message = 'quote requests cannot set a price';
      end if;
      effective_price := null;
    when 'CLIENT_OFFER' then
      if caller_id <> target_client_id then
        raise exception using errcode = '42501', message = 'only the client can create a client offer';
      end if;
      if not service_accepts_offers then
        raise exception using errcode = '42501', message = 'this service does not accept offers';
      end if;
      if proposed_price_amount is null or proposed_price_amount <= 0 then
        raise exception using errcode = '22023', message = 'client offer requires a positive price';
      end if;
      effective_price := proposed_price_amount;
    when 'PROVIDER_QUOTE' then
      if caller_id <> target_provider_id then
        raise exception using errcode = '42501', message = 'only the provider can create a provider quote';
      end if;
      if proposed_price_amount is null or proposed_price_amount <= 0 then
        raise exception using errcode = '22023', message = 'provider quote requires a positive price';
      end if;
      effective_price := proposed_price_amount;
    when 'COUNTEROFFER' then
      raise exception using errcode = '22023', message = 'counteroffers require an existing proposal';
  end case;

  insert into public.proposals (
    conversation_id,
    service_id,
    client_user_id,
    provider_user_id,
    kind,
    status,
    created_by_user_id,
    expires_at,
    created_at,
    updated_at
  ) values (
    target_conversation_id,
    target_service_id,
    target_client_id,
    target_provider_id,
    requested_kind,
    created_status,
    caller_id,
    proposal_expires_at,
    event_time,
    event_time
  )
  returning id into created_proposal_id;

  insert into public.proposal_versions (
    proposal_id,
    version_number,
    kind,
    authored_by_user_id,
    service_title_snapshot,
    service_description_snapshot,
    modality,
    scope_snapshot,
    price_model_snapshot,
    price_amount,
    currency_code,
    schedule_type,
    schedule_start_at,
    schedule_end_at,
    deadline_at,
    expected_duration_minutes,
    includes_snapshot,
    materials_notes_snapshot,
    created_at
  ) values (
    created_proposal_id,
    1,
    requested_kind,
    caller_id,
    service_title,
    service_description,
    service_modality,
    effective_scope,
    service_price_model,
    effective_price,
    service_currency,
    service_schedule_type,
    proposed_schedule_start_at,
    proposed_schedule_end_at,
    proposed_deadline_at,
    service_duration,
    service_includes,
    service_materials,
    event_time
  )
  returning id into created_version_id;

  update public.proposals
  set current_version_id = created_version_id,
      accepted_version_id = case
        when requested_kind = 'DIRECT_BOOKING' then created_version_id
        else null
      end
  where id = created_proposal_id;
  -- Hire-on-accept (reserva directa): nace CONFIRMED al crearla.
  if requested_kind = 'DIRECT_BOOKING' then
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
    target_conversation_id,
    target_service_id,
    target_client_id,
    target_provider_id,
    created_version_id,
    null,
    'CONFIRMED',
    event_time,
    event_time,
    event_time
  )
  on conflict (accepted_proposal_version_id)
  do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id;
  end if;


  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    created_proposal_id,
    created_version_id,
    caller_id,
    case when requested_kind = 'DIRECT_BOOKING' then 'DIRECT_BOOKING_CREATED' else 'PROPOSAL_CREATED' end,
    jsonb_build_object('kind', requested_kind::text, 'status', created_status::text),
    event_time
  );

  insert into public.messages (
    conversation_id,
    sender_user_id,
    kind,
    body,
    created_at
  ) values (
    target_conversation_id,
    null,
    'SYSTEM',
    case when requested_kind = 'DIRECT_BOOKING'
      then 'Reserva directa creada. ¡Trabajo confirmado!'
      else 'Se creó una propuesta estructurada.'
    end,
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_conversation_id;

  return created_proposal_id;
end;
$$;

revoke all on function public.create_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.create_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) to authenticated, service_role;

create or replace function public.respond_to_proposal(
  target_proposal_id uuid,
  response_action text
)
returns public.proposal_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_proposal public.proposals%rowtype;
  current_version public.proposal_versions%rowtype;
  normalized_action text := upper(btrim(response_action));
  next_status public.proposal_status;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into target_proposal
  from public.proposals
  where id = target_proposal_id
  for update;

  if target_proposal.id is null
    or caller_id not in (target_proposal.client_user_id, target_proposal.provider_user_id) then
    raise exception using errcode = '42501', message = 'proposal access denied';
  end if;

  if target_proposal.status <> 'OPEN' then
    return target_proposal.status;
  end if;

  if target_proposal.expires_at is not null and target_proposal.expires_at <= event_time then
    update public.proposals set status = 'EXPIRED' where id = target_proposal_id;
    insert into public.proposal_events (proposal_id, actor_user_id, event_type, created_at)
    values (target_proposal_id, null, 'PROPOSAL_EXPIRED', event_time);
    return 'EXPIRED';
  end if;

  select * into current_version
  from public.proposal_versions
  where id = target_proposal.current_version_id;

  case normalized_action
    when 'WITHDRAW' then
      if caller_id <> current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'only the current proposal author can withdraw it';
      end if;
      next_status := 'WITHDRAWN';
    when 'REJECT' then
      if caller_id = current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'proposal author cannot reject their own terms';
      end if;
      next_status := 'REJECTED';
    when 'ACCEPT' then
      if current_version.price_amount is null then
        raise exception using errcode = '22023', message = 'a priced proposal is required before acceptance';
      end if;
      if caller_id = current_version.authored_by_user_id then
        raise exception using errcode = '42501', message = 'proposal author cannot accept their own terms';
      end if;
      if caller_id = target_proposal.client_user_id
        and current_version.authored_by_user_id <> target_proposal.provider_user_id then
        raise exception using errcode = '42501', message = 'client can only accept provider-authored terms';
      end if;
      if caller_id = target_proposal.provider_user_id
        and current_version.authored_by_user_id <> target_proposal.client_user_id then
        raise exception using errcode = '42501', message = 'provider can only accept client-authored terms';
      end if;
      next_status := 'ACCEPTED';
    else
      raise exception using errcode = '22023', message = 'unknown proposal action';
  end case;

  update public.proposals
  set status = next_status,
      accepted_version_id = case
        when normalized_action = 'ACCEPT' then current_version.id
        else accepted_version_id
      end,
      updated_at = event_time
  where id = target_proposal_id;
  -- Hire-on-accept: el trabajo nace CONFIRMED al aceptar; el pago se
  -- liquida al cierre, nunca por adelantado.
  if normalized_action = 'ACCEPT' then
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
    current_version.id,
    null,
    'CONFIRMED',
    event_time,
    event_time,
    event_time
  )
  on conflict (accepted_proposal_version_id)
  do update set accepted_proposal_version_id = excluded.accepted_proposal_version_id;
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
    current_version.id,
    caller_id,
    case normalized_action
      when 'ACCEPT' then 'PROPOSAL_ACCEPTED'
      when 'REJECT' then 'PROPOSAL_REJECTED'
      else 'PROPOSAL_WITHDRAWN'
    end,
    jsonb_build_object('status', next_status::text),
    event_time
  );

  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_proposal.conversation_id,
    null,
    'SYSTEM',
    case normalized_action
      when 'ACCEPT' then 'Propuesta aceptada. ¡Trabajo confirmado!'
      when 'REJECT' then 'La propuesta fue rechazada.'
      else 'La propuesta fue retirada.'
    end,
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return next_status;
end;
$$;

revoke all on function public.respond_to_proposal(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_to_proposal(uuid, text)
to authenticated, service_role;


-- Auto-confirmación: sin respuesta del cliente en 7 días se da por bien
-- hecho (el proveedor puede apelar por disputa).
create or replace function public.auto_complete_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  completed_count integer := 0;
  stale_job record;
begin
  for stale_job in
    select id, conversation_id
    from public.jobs
    where status = 'COMPLETION_REQUESTED'
      and updated_at < timezone('utc', now()) - interval '7 days'
    order by updated_at
    limit 500
  loop
    update public.jobs
    set status = 'COMPLETED', updated_at = timezone('utc', now())
    where id = stale_job.id;

    insert into public.job_events (job_id, actor_user_id, event_type, from_status, to_status, created_at)
    values (stale_job.id, null, 'JOB_AUTO_COMPLETED', 'COMPLETION_REQUESTED', 'COMPLETED', timezone('utc', now()));

    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (stale_job.conversation_id, null, 'SYSTEM', 'Trabajo confirmado automáticamente por falta de respuesta.', timezone('utc', now()));

    update public.conversations
    set last_message_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = stale_job.conversation_id;

    completed_count := completed_count + 1;
  end loop;

  return completed_count;
end;
$$;

revoke all on function public.auto_complete_stale_jobs()
from public, anon, authenticated, service_role;

select cron.schedule(
  'jobs-auto-complete',
  '0 4 * * *',
  'select public.auto_complete_stale_jobs()'
);
