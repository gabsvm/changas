-- Audit fix: blocking a conversation froze messages but left proposals open,
-- so a blocked user could force a CONFIRMED job via direct booking. All three
-- user-driven proposal RPCs now enforce the same block predicate as messaging.
-- Payment reconciliation writes are untouched on purpose: money truth must land.

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

  -- Audit fix: a blocked conversation freezes proposals for both parties,
  -- mirroring the messaging guard (a block must also stop direct booking).
  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = target_conversation_id
      and (
        (b.blocker_user_id = caller_id and b.blocked_user_id in (target_client_id, target_provider_id))
        or (b.blocked_user_id = caller_id and b.blocker_user_id in (target_client_id, target_provider_id))
      )
  ) then
    raise exception using errcode = '42501', message = 'conversation proposals are blocked';
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

  -- Audit fix: a blocked conversation freezes proposals for both parties,
  -- mirroring the messaging guard (a block must also stop direct booking).
  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = target_proposal.conversation_id
      and (
        (b.blocker_user_id = caller_id and b.blocked_user_id in (target_proposal.client_user_id, target_proposal.provider_user_id))
        or (b.blocked_user_id = caller_id and b.blocker_user_id in (target_proposal.client_user_id, target_proposal.provider_user_id))
      )
  ) then
    raise exception using errcode = '42501', message = 'conversation proposals are blocked';
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

create or replace function public.revise_conversation_proposal(
  target_proposal_id uuid,
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
  target_proposal public.proposals%rowtype;
  current_version public.proposal_versions%rowtype;
  service_row public.services%rowtype;
  next_version_number integer;
  next_scope text;
  next_price bigint;
  created_version_id uuid;
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

  -- Audit fix: a blocked conversation freezes proposals for both parties,
  -- mirroring the messaging guard (a block must also stop direct booking).
  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = target_proposal.conversation_id
      and (
        (b.blocker_user_id = caller_id and b.blocked_user_id in (target_proposal.client_user_id, target_proposal.provider_user_id))
        or (b.blocked_user_id = caller_id and b.blocker_user_id in (target_proposal.client_user_id, target_proposal.provider_user_id))
      )
  ) then
    raise exception using errcode = '42501', message = 'conversation proposals are blocked';
  end if;

  if target_proposal.status <> 'OPEN' then
    raise exception using errcode = '42501', message = 'only open proposals can be revised';
  end if;

  if target_proposal.expires_at is not null and target_proposal.expires_at <= event_time then
    update public.proposals
    set status = 'EXPIRED',
        updated_at = event_time
    where id = target_proposal_id;

    insert into public.proposal_events (
      proposal_id,
      actor_user_id,
      event_type,
      created_at
    ) values (
      target_proposal_id,
      null,
      'PROPOSAL_EXPIRED',
      event_time
    );

    return null;
  end if;

  select * into current_version
  from public.proposal_versions
  where id = target_proposal.current_version_id;

  select * into service_row
  from public.services
  where id = target_proposal.service_id;

  if caller_id = current_version.authored_by_user_id then
    if requested_kind <> current_version.kind then
      raise exception using errcode = '22023', message = 'author revisions must keep the proposal kind';
    end if;
  elsif caller_id = target_proposal.provider_user_id then
    if requested_kind not in ('PROVIDER_QUOTE', 'COUNTEROFFER') then
      raise exception using errcode = '22023', message = 'provider response must be a quote or counteroffer';
    end if;
  elsif caller_id = target_proposal.client_user_id then
    if requested_kind <> 'COUNTEROFFER' then
      raise exception using errcode = '22023', message = 'client response must be a counteroffer';
    end if;
  end if;

  if requested_kind = 'QUOTE_REQUEST' then
    if proposed_price_amount is not null then
      raise exception using errcode = '22023', message = 'quote requests cannot set a price';
    end if;
    next_price := null;
  else
    next_price := coalesce(proposed_price_amount, current_version.price_amount);
    if next_price is null or next_price <= 0 then
      raise exception using errcode = '22023', message = 'proposal revision requires a positive price';
    end if;
  end if;

  if proposed_schedule_end_at is not null
    and proposed_schedule_start_at is not null
    and proposed_schedule_end_at <= proposed_schedule_start_at then
    raise exception using errcode = '22023', message = 'schedule end must be after start';
  end if;

  next_scope := coalesce(nullif(btrim(scope_text), ''), current_version.scope_snapshot);
  if char_length(next_scope) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'proposal scope is invalid';
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version_number
  from public.proposal_versions
  where proposal_id = target_proposal_id;

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
    target_proposal_id,
    next_version_number,
    requested_kind,
    caller_id,
    service_row.title,
    service_row.description,
    service_row.modality,
    next_scope,
    service_row.price_model,
    next_price,
    service_row.currency_code,
    service_row.schedule_type,
    coalesce(proposed_schedule_start_at, current_version.schedule_start_at),
    coalesce(proposed_schedule_end_at, current_version.schedule_end_at),
    coalesce(proposed_deadline_at, current_version.deadline_at),
    service_row.expected_duration_minutes,
    service_row.includes,
    service_row.materials_notes,
    event_time
  )
  returning id into created_version_id;

  update public.proposals
  set current_version_id = created_version_id,
      kind = requested_kind,
      expires_at = coalesce(proposal_expires_at, expires_at),
      updated_at = event_time
  where id = target_proposal_id;

  insert into public.proposal_events (
    proposal_id,
    proposal_version_id,
    actor_user_id,
    event_type,
    metadata,
    created_at
  ) values (
    target_proposal_id,
    created_version_id,
    caller_id,
    'PROPOSAL_REVISED',
    jsonb_build_object('kind', requested_kind::text, 'version', next_version_number),
    event_time
  );

  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_proposal.conversation_id,
    null,
    'SYSTEM',
    'La propuesta fue actualizada.',
    event_time
  );

  update public.conversations
  set last_message_at = event_time,
      updated_at = event_time
  where id = target_proposal.conversation_id;

  return created_version_id;
end;
$$;

revoke all on function public.revise_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.revise_conversation_proposal(
  uuid,
  public.proposal_kind,
  text,
  bigint,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
) to authenticated, service_role;
