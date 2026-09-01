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
