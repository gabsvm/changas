-- Push real para mensajes: el trigger phase08_notify_message_created ya existe,
-- solo se habilita la pata push del enqueue (antes push_eligible = false, el
-- click llegaba muerto porque nunca se encolaba delivery PUSH).
-- Sin DROPs: CREATE OR REPLACE sobre la función existente definida en
-- 20260902161000_phase_08_notification_routing.sql.

create or replace function public.phase08_route_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_row public.conversations%rowtype;
  recipient_id uuid;
begin
  if new.sender_user_id is null or new.kind = 'SYSTEM'::public.message_kind then
    return new;
  end if;

  select conversation.*
  into conversation_row
  from public.conversations conversation
  where conversation.id = new.conversation_id;

  if not found then
    return new;
  end if;

  recipient_id := case
    when new.sender_user_id = conversation_row.client_user_id then conversation_row.provider_user_id
    when new.sender_user_id = conversation_row.provider_user_id then conversation_row.client_user_id
    else null
  end;

  if recipient_id is null then
    return new;
  end if;

  perform public.enqueue_user_notification(
    recipient_id,
    'MESSAGE'::public.notification_kind,
    'Nuevo mensaje',
    'Tenés un mensaje nuevo en Changas.',
    '/messages/' || conversation_row.id::text,
    'MESSAGE_CREATED',
    new.id,
    'conversation',
    conversation_row.id,
    true,
    false
  );

  return new;
end;
$$;
