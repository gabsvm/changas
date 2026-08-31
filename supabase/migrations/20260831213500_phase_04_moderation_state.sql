create or replace function public.get_my_conversation_block_state(
  target_conversation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  blocked_id uuid;
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

  select b.blocked_user_id
    into blocked_id
  from public.user_blocks b
  where b.conversation_id = target_conversation_id
    and b.blocker_user_id = caller_id
  order by b.created_at desc
  limit 1;

  return blocked_id;
end;
$$;

revoke all on function public.get_my_conversation_block_state(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_my_conversation_block_state(uuid)
to authenticated, service_role;
