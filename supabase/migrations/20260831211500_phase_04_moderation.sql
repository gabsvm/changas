-- Phase 04 Task 6: participant-scoped blocking, reporting and moderation warnings.
-- Blocking is represented by durable user_blocks rows; conversation history is
-- never deleted and the conversation status is not mutated by a reversible block.

create or replace function public.block_user_for_conversation(
  target_conversation_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_client_id uuid;
  target_provider_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select c.client_user_id, c.provider_user_id
    into target_client_id, target_provider_id
  from public.conversations c
  where c.id = target_conversation_id;

  if target_client_id is null
    or (caller_id <> target_client_id and caller_id <> target_provider_id) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  if target_user_id is null
    or target_user_id = caller_id
    or (target_user_id <> target_client_id and target_user_id <> target_provider_id) then
    raise exception using errcode = '42501', message = 'only the other conversation participant can be blocked';
  end if;

  insert into public.user_blocks (
    conversation_id,
    blocker_user_id,
    blocked_user_id
  ) values (
    target_conversation_id,
    caller_id,
    target_user_id
  )
  on conflict (conversation_id, blocker_user_id, blocked_user_id) do nothing;

  return target_user_id;
end;
$$;

revoke all on function public.block_user_for_conversation(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.block_user_for_conversation(uuid, uuid)
to authenticated, service_role;

create or replace function public.unblock_user(
  target_conversation_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_client_id uuid;
  target_provider_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select c.client_user_id, c.provider_user_id
    into target_client_id, target_provider_id
  from public.conversations c
  where c.id = target_conversation_id;

  if target_client_id is null
    or (caller_id <> target_client_id and caller_id <> target_provider_id) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  if target_user_id is null
    or target_user_id = caller_id
    or (target_user_id <> target_client_id and target_user_id <> target_provider_id) then
    raise exception using errcode = '42501', message = 'only the other conversation participant can be unblocked';
  end if;

  delete from public.user_blocks b
  where b.conversation_id = target_conversation_id
    and b.blocker_user_id = caller_id
    and b.blocked_user_id = target_user_id;

  return target_user_id;
end;
$$;

revoke all on function public.unblock_user(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.unblock_user(uuid, uuid)
to authenticated, service_role;

create or replace function public.report_conversation(
  target_conversation_id uuid,
  report_category text,
  report_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  report_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (c.client_user_id = caller_id or c.provider_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  if report_category is null or char_length(btrim(report_category)) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'invalid report category';
  end if;

  if report_reason is not null
    and char_length(btrim(report_reason)) not between 2 and 2000 then
    raise exception using errcode = '22023', message = 'invalid report reason';
  end if;

  insert into public.conversation_reports (
    conversation_id,
    reporter_user_id,
    category,
    reason
  ) values (
    target_conversation_id,
    caller_id,
    upper(btrim(report_category)),
    case when report_reason is null then null else btrim(report_reason) end
  )
  returning id into report_id;

  return report_id;
end;
$$;

revoke all on function public.report_conversation(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.report_conversation(uuid, text, text)
to authenticated, service_role;

create or replace function public.record_conversation_moderation_warning(
  target_conversation_id uuid,
  signal_types text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  event_id uuid;
  normalized_signals text[];
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (c.client_user_id = caller_id or c.provider_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  select coalesce(array_agg(distinct upper(btrim(signal))), array[]::text[])
    into normalized_signals
  from unnest(coalesce(signal_types, array[]::text[])) as signal
  where btrim(signal) <> '';

  if coalesce(array_length(normalized_signals, 1), 0) = 0
    or exists (
      select 1
      from unnest(normalized_signals) as signal
      where signal not in (
        'PHONE',
        'EMAIL',
        'PAYMENT_HANDLE',
        'EXTERNAL_CONTACT_REQUEST'
      )
    ) then
    raise exception using errcode = '22023', message = 'invalid moderation warning signal types';
  end if;

  insert into public.conversation_moderation_events (
    conversation_id,
    actor_user_id,
    event_type,
    metadata
  ) values (
    target_conversation_id,
    caller_id,
    'CONTACT_LEAKAGE_WARNING',
    jsonb_build_object('signals', to_jsonb(normalized_signals))
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.record_conversation_moderation_warning(uuid, text[])
from public, anon, authenticated, service_role;
grant execute on function public.record_conversation_moderation_warning(uuid, text[])
to authenticated, service_role;
