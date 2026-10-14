-- P0 prod (circuito 14-10-2026): `respond_to_proposal` y
-- `respond_job_scope_change` fallan en runtime con SQL 42702
-- `column reference "response_reason" is ambiguous`.
--
-- Causa: `20261013080000_lifecycle_hardening.sql` agregó las columnas
-- `proposals.response_reason` y `job_scope_changes.response_reason`, pero los
-- UPDATE de respuesta usan `else response_reason` sin calificar: el nombre
-- ahora resuelve tanto al argumento de la función como a la columna.
-- Antes de la columna, el ELSE se autoasignaba desde el argumento; con la
-- columna, Postgres rechaza la sentencia y TODA respuesta a propuestas
-- (ACCEPT/REJECT/WITHDRAW) y a scope-changes queda rota en producción.
--
-- Fix mínimo append-only: mismos cuerpos, con alias de tabla (`p`, `sc`)
-- en las auto-referencias de columna. Sin cambios de firma, sin grants
-- nuevos, sin push a prod (runbook manual).

-- 1) respond_to_proposal(uuid,text,text): califica p.accepted_version_id y
-- p.response_reason en los ELSE.
create or replace function public.respond_to_proposal(
  target_proposal_id uuid,
  response_action text,
  response_reason text default null
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
  normalized_reason text := nullif(btrim(coalesce(response_reason, '')), '');
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
      if normalized_reason is not null and char_length(normalized_reason) < 2 then
        raise exception using errcode = '22023', message = 'rejection reason is too short';
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

  update public.proposals as p
  set status = next_status,
      accepted_version_id = case
        when normalized_action = 'ACCEPT' then current_version.id
        else p.accepted_version_id
      end,
      response_reason = case
        when normalized_action = 'REJECT' then normalized_reason
        else p.response_reason
      end,
      updated_at = event_time
  where p.id = target_proposal_id;

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
    jsonb_build_object('status', next_status::text, 'reason', normalized_reason),
    event_time
  );

  insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
  values (
    target_proposal.conversation_id,
    null,
    'SYSTEM',
    case normalized_action
      when 'ACCEPT' then 'Propuesta aceptada. ¡Trabajo confirmado!'
      when 'REJECT' then case
        when normalized_reason is not null then 'La propuesta fue rechazada: ' || normalized_reason
        else 'La propuesta fue rechazada.'
      end
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

revoke all on function public.respond_to_proposal(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_to_proposal(uuid, text, text)
to authenticated, service_role;

-- 2) respond_job_scope_change(uuid,text,text): califica sc.response_reason
-- en el ELSE. Cuerpo idéntico al de 20261013080000 salvo el alias.
create or replace function public.respond_job_scope_change(
  target_scope_change_id uuid,
  response_action text,
  response_reason text default null
)
returns public.job_scope_change_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_change public.job_scope_changes%rowtype;
  target_job public.jobs%rowtype;
  target_conversation public.conversations%rowtype;
  normalized_action text := upper(btrim(response_action));
  normalized_reason text := nullif(btrim(coalesce(response_reason, '')), '');
  next_status public.job_scope_change_status;
  event_time timestamptz := timezone('utc', now());
begin
  if caller_id is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into target_change from public.job_scope_changes where id = target_scope_change_id for update;
  if target_change.id is null then raise exception using errcode = 'P0002', message = 'scope change not found'; end if;
  select * into target_job from public.jobs where id = target_change.job_id for update;
  if caller_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the client can respond to a scope change';
  end if;
  if target_change.status <> 'OPEN' then return target_change.status; end if;

  if normalized_action = 'REJECT' then
    if normalized_reason is not null and char_length(normalized_reason) < 2 then
      raise exception using errcode = '22023', message = 'rejection reason is too short';
    end if;
    next_status := 'REJECTED';
  elsif normalized_action = 'ACCEPT' then
    next_status := case when target_change.additional_amount_minor > 0 then 'AWAITING_PAYMENT' else 'PAID' end;
  else
    raise exception using errcode = '22023', message = 'invalid scope change response';
  end if;

  update public.job_scope_changes as sc
  set status = next_status,
      client_responded_at = event_time,
      response_reason = case
        when normalized_action = 'REJECT' then normalized_reason
        else sc.response_reason
      end,
      updated_at = event_time
  where sc.id = target_scope_change_id;
  insert into public.job_events (job_id, actor_user_id, event_type, metadata)
  values (target_job.id, caller_id, case when normalized_action = 'ACCEPT' then 'SCOPE_CHANGE_ACCEPTED' else 'SCOPE_CHANGE_REJECTED' end,
    jsonb_build_object('scope_change_id', target_scope_change_id, 'status', next_status::text, 'reason', normalized_reason));

  select * into target_conversation
  from public.conversations
  where id = target_job.conversation_id;

  if target_conversation.id is not null
    and target_conversation.status = 'OPEN'
    and not exists (
      select 1 from public.user_blocks
      where conversation_id = target_job.conversation_id
    ) then
    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id,
      null,
      'SYSTEM',
      case normalized_action
        when 'ACCEPT' then 'Cambio de alcance aceptado.'
        else case
          when normalized_reason is not null then 'Cambio de alcance rechazado: ' || normalized_reason
          else 'Cambio de alcance rechazado.'
        end
      end,
      event_time
    );

    update public.conversations
    set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return next_status;
end;
$$;

revoke all on function public.respond_job_scope_change(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.respond_job_scope_change(uuid, text, text)
to authenticated, service_role;
