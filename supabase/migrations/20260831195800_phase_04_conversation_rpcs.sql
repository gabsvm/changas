-- Phase 04 Task 2: contextual conversation start, bounded inbox and context.

create or replace function public.start_service_conversation(
  target_provider_slug text,
  target_service_slug text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_service_id uuid;
  target_provider_id uuid;
  conversation_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select s.id, s.provider_user_id
    into target_service_id, target_provider_id
  from public.services s
  join public.provider_profiles pp on pp.user_id = s.provider_user_id
  where pp.public_slug = target_provider_slug
    and pp.status = 'ACTIVE'
    and pp.marketplace_paused = false
    and s.public_slug = target_service_slug
    and s.is_published = true
    and s.is_paused = false
  limit 1;

  if target_service_id is null or target_provider_id is null then
    raise exception using errcode = 'P0002', message = 'service not found';
  end if;

  if caller_id = target_provider_id then
    raise exception using errcode = '22023', message = 'cannot start a conversation with your own service';
  end if;

  insert into public.conversations (
    service_id,
    client_user_id,
    provider_user_id
  ) values (
    target_service_id,
    caller_id,
    target_provider_id
  )
  on conflict (service_id, client_user_id, provider_user_id)
  do update set updated_at = public.conversations.updated_at
  returning id into conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (conversation_id, caller_id, 'CLIENT'),
    (conversation_id, target_provider_id, 'PROVIDER')
  on conflict (conversation_id, user_id) do nothing;

  return conversation_id;
end;
$$;

revoke all on function public.start_service_conversation(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.start_service_conversation(text, text)
to authenticated, service_role;

create or replace function public.list_my_conversations(
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
  last_message_at timestamptz,
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
    c.id,
    c.service_id,
    s.title,
    s.public_slug,
    pp.public_slug,
    case when c.client_user_id = caller_id then c.provider_user_id else c.client_user_id end,
    peer.display_name,
    peer.avatar_url,
    c.status,
    c.last_message_at,
    c.updated_at
  from public.conversations c
  join public.services s on s.id = c.service_id
  join public.provider_profiles pp on pp.user_id = c.provider_user_id
  join public.profiles peer
    on peer.id = case when c.client_user_id = caller_id then c.provider_user_id else c.client_user_id end
  where (c.client_user_id = caller_id or c.provider_user_id = caller_id)
    and (
      before_updated_at is null
      or c.updated_at < before_updated_at
      or (c.updated_at = before_updated_at and before_id is not null and c.id < before_id)
    )
  order by c.updated_at desc, c.id desc
  limit bounded_page_size;
end;
$$;

revoke all on function public.list_my_conversations(integer, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_my_conversations(integer, timestamptz, uuid)
to authenticated, service_role;

create or replace function public.get_conversation_context(
  target_conversation_id uuid
)
returns table (
  conversation_id uuid,
  service_id uuid,
  service_title text,
  service_slug text,
  provider_user_id uuid,
  provider_slug text,
  provider_display_name text,
  client_user_id uuid,
  client_display_name text,
  status public.conversation_status,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz
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
    c.id,
    c.service_id,
    s.title,
    s.public_slug,
    c.provider_user_id,
    pp.public_slug,
    provider_profile.display_name,
    c.client_user_id,
    client_profile.display_name,
    c.status,
    c.created_at,
    c.updated_at,
    c.last_message_at
  from public.conversations c
  join public.services s on s.id = c.service_id
  join public.provider_profiles pp on pp.user_id = c.provider_user_id
  join public.profiles provider_profile on provider_profile.id = c.provider_user_id
  join public.profiles client_profile on client_profile.id = c.client_user_id
  where c.id = target_conversation_id;
end;
$$;

revoke all on function public.get_conversation_context(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_conversation_context(uuid)
to authenticated, service_role;
