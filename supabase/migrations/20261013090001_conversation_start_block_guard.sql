-- El inicio de conversación ahora respeta bloqueos del par en cualquier
-- hilo: si alguno de los dos bloqueó al otro (en cualquier conversación),
-- no se puede abrir un hilo nuevo entre ellos. Sin cambio de schema: solo
-- se agrega el predicado sobre public.user_blocks existente.
-- El resto de la función queda idéntico al original de Phase 04.

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
  created_conversation_id uuid;
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

  -- Bloqueo del par en cualquier hilo: un bloqueo congela el vínculo, no
  -- solo el hilo donde se marcó (igual que el guard de propuestas).
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_user_id = caller_id and b.blocked_user_id = target_provider_id)
       or (b.blocker_user_id = target_provider_id and b.blocked_user_id = caller_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation start is blocked';
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
  returning id into created_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (created_conversation_id, caller_id, 'CLIENT'),
    (created_conversation_id, target_provider_id, 'PROVIDER')
  on conflict (conversation_id, user_id) do nothing;

  return created_conversation_id;
end;
$$;

revoke all on function public.start_service_conversation(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.start_service_conversation(text, text)
to authenticated, service_role;
