-- Phase 04 Task 3: idempotent text messaging and bounded keyset pagination.

create or replace function public.send_conversation_text(
  target_conversation_id uuid,
  message_body text,
  message_nonce uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  existing_message_id uuid;
  existing_sender_id uuid;
  target_client_id uuid;
  target_provider_id uuid;
  target_status public.conversation_status;
  sent_message_id uuid;
  sent_at timestamptz := timezone('utc', now());
  recent_message_count integer;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if message_nonce is null then
    raise exception using errcode = '22023', message = 'message nonce is required';
  end if;

  if message_body is null or char_length(btrim(message_body)) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'message body must contain between 1 and 4000 characters';
  end if;

  select c.client_user_id, c.provider_user_id, c.status
    into target_client_id, target_provider_id, target_status
  from public.conversations c
  where c.id = target_conversation_id;

  if target_client_id is null
    or (caller_id <> target_client_id and caller_id <> target_provider_id) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  if target_status <> 'OPEN' then
    raise exception using errcode = '42501', message = 'conversation is not open';
  end if;

  select m.id, m.sender_user_id
    into existing_message_id, existing_sender_id
  from public.messages m
  where m.conversation_id = target_conversation_id
    and m.client_nonce = message_nonce
  limit 1;

  if existing_message_id is not null then
    if existing_sender_id = caller_id then
      return existing_message_id;
    end if;

    raise exception using errcode = '23505', message = 'message nonce conflict';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = target_conversation_id
      and (
        (b.blocker_user_id = caller_id and b.blocked_user_id in (target_client_id, target_provider_id))
        or (b.blocked_user_id = caller_id and b.blocker_user_id in (target_client_id, target_provider_id))
      )
  ) then
    raise exception using errcode = '42501', message = 'conversation messaging is blocked';
  end if;

  select count(*)::integer
    into recent_message_count
  from public.messages m
  where m.conversation_id = target_conversation_id
    and m.sender_user_id = caller_id
    and m.kind <> 'SYSTEM'
    and m.created_at >= sent_at - interval '1 minute';

  if recent_message_count >= 20 then
    raise exception using errcode = '42900', message = 'message rate limit exceeded';
  end if;

  insert into public.messages (
    conversation_id,
    sender_user_id,
    kind,
    body,
    client_nonce,
    created_at
  ) values (
    target_conversation_id,
    caller_id,
    'TEXT',
    btrim(message_body),
    message_nonce,
    sent_at
  )
  returning id into sent_message_id;

  update public.conversations
  set last_message_at = sent_at,
      updated_at = sent_at
  where id = target_conversation_id;

  return sent_message_id;
end;
$$;

revoke all on function public.send_conversation_text(uuid, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.send_conversation_text(uuid, text, uuid)
to authenticated, service_role;

create or replace function public.list_conversation_messages(
  target_conversation_id uuid,
  before_created_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 50
)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  kind public.message_kind,
  body text,
  created_at timestamptz
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

  if page_size is null or page_size < 1 or page_size > 50 then
    raise exception using errcode = '22023', message = 'page size must be between 1 and 50';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (c.client_user_id = caller_id or c.provider_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  return query
  select
    m.id,
    m.conversation_id,
    m.sender_user_id,
    m.kind,
    m.body,
    m.created_at
  from public.messages m
  where m.conversation_id = target_conversation_id
    and (
      before_created_at is null
      or m.created_at < before_created_at
      or (m.created_at = before_created_at and before_id is not null and m.id < before_id)
    )
  order by m.created_at desc, m.id desc
  limit page_size;
end;
$$;

revoke all on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
to authenticated, service_role;
