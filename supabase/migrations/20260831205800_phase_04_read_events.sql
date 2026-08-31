-- Phase 04: per-participant read cursors, inbox unread data and immutable system events.

create or replace function public.mark_conversation_read(
  target_conversation_id uuid,
  through_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_message_created_at timestamptz;
  current_message_created_at timestamptz;
  current_message_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = caller_id
  ) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  select message.created_at
    into target_message_created_at
  from public.messages message
  where message.id = through_message_id
    and message.conversation_id = target_conversation_id;

  if target_message_created_at is null then
    raise exception 'Message not found in conversation' using errcode = 'P0002';
  end if;

  select message.created_at, reads.last_read_message_id
    into current_message_created_at, current_message_id
  from public.conversation_reads reads
  left join public.messages message on message.id = reads.last_read_message_id
  where reads.conversation_id = target_conversation_id
    and reads.user_id = caller_id;

  if current_message_created_at is not null
     and (target_message_created_at, through_message_id) <= (current_message_created_at, current_message_id) then
    return;
  end if;

  insert into public.conversation_reads (
    conversation_id,
    user_id,
    last_read_message_id,
    last_read_at
  ) values (
    target_conversation_id,
    caller_id,
    through_message_id,
    timezone('utc', now())
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_message_id = excluded.last_read_message_id,
    last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_conversation_read(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid, uuid)
to authenticated, service_role;

create or replace function public.append_conversation_system_event(
  target_conversation_id uuid,
  event_body text,
  event_nonce uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_message_id uuid;
  normalized_body text := btrim(event_body);
begin
  if normalized_body is null or char_length(normalized_body) not between 1 and 4000 then
    raise exception 'System event body must contain 1 to 4000 characters' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.conversations conversation
    where conversation.id = target_conversation_id
  ) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  select message.id into created_message_id
  from public.messages message
  where message.conversation_id = target_conversation_id
    and message.client_nonce = event_nonce;

  if created_message_id is not null then
    if not exists (
      select 1 from public.messages message
      where message.id = created_message_id
        and message.kind = 'SYSTEM'::public.message_kind
        and message.sender_user_id is null
    ) then
      raise exception 'Nonce conflicts with another message' using errcode = '23505';
    end if;
    return created_message_id;
  end if;

  insert into public.messages (
    conversation_id,
    sender_user_id,
    kind,
    body,
    client_nonce
  ) values (
    target_conversation_id,
    null,
    'SYSTEM',
    normalized_body,
    event_nonce
  )
  returning id into created_message_id;

  update public.conversations
  set last_message_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = target_conversation_id;

  return created_message_id;
end;
$$;

revoke all on function public.append_conversation_system_event(uuid, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.append_conversation_system_event(uuid, text, uuid)
to service_role;

-- The Phase 02 inbox contract predates read cursors. Replace it now with the
-- participant-safe preview/kind/unread fields required by Phase 04.
drop function public.list_my_conversations(integer, timestamptz, uuid);

create function public.list_my_conversations(
  page_size integer default 20,
  before_updated_at timestamptz default null,
  before_id uuid default null
)
returns table (
  conversation_id uuid,
  service_id uuid,
  service_title text,
  service_slug text,
  provider_slug text,
  peer_user_id uuid,
  peer_display_name text,
  peer_avatar_url text,
  status public.conversation_status,
  last_message_preview text,
  last_message_kind public.message_kind,
  last_message_at timestamptz,
  unread_count bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  bounded_page_size integer := least(greatest(coalesce(page_size, 20), 1), 50);
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    conversation.id,
    conversation.service_id,
    service.title,
    service.public_slug,
    provider.public_slug,
    case
      when conversation.client_user_id = caller_id then conversation.provider_user_id
      else conversation.client_user_id
    end as peer_user_id,
    peer.display_name,
    peer.avatar_url,
    conversation.status,
    case
      when latest.kind = 'TEXT'::public.message_kind then left(latest.body, 160)
      when latest.kind = 'IMAGE'::public.message_kind then 'Imagen'
      when latest.kind = 'FILE'::public.message_kind then 'Archivo'
      when latest.kind = 'SYSTEM'::public.message_kind then left(latest.body, 160)
      else null
    end as last_message_preview,
    latest.kind,
    latest.created_at,
    coalesce(unread.unread_count, 0)::bigint,
    conversation.updated_at
  from public.conversations conversation
  join public.services service on service.id = conversation.service_id
  join public.provider_profiles provider on provider.user_id = conversation.provider_user_id
  join public.profiles peer
    on peer.id = case
      when conversation.client_user_id = caller_id then conversation.provider_user_id
      else conversation.client_user_id
    end
  left join lateral (
    select message.id, message.kind, message.body, message.created_at
    from public.messages message
    where message.conversation_id = conversation.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join public.conversation_reads reads
    on reads.conversation_id = conversation.id
   and reads.user_id = caller_id
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages message
    left join public.messages read_message on read_message.id = reads.last_read_message_id
    where message.conversation_id = conversation.id
      and (message.sender_user_id is null or message.sender_user_id <> caller_id)
      and (
        reads.last_read_message_id is null
        or (message.created_at, message.id) > (read_message.created_at, read_message.id)
      )
  ) unread on true
  where (conversation.client_user_id = caller_id or conversation.provider_user_id = caller_id)
    and (
      before_updated_at is null
      or conversation.updated_at < before_updated_at
      or (
        conversation.updated_at = before_updated_at
        and before_id is not null
        and conversation.id < before_id
      )
    )
  order by conversation.updated_at desc, conversation.id desc
  limit bounded_page_size;
end;
$$;

revoke all on function public.list_my_conversations(integer, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_conversations(integer, timestamptz, uuid)
to authenticated, service_role;
