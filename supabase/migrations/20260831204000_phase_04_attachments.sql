-- Phase 04: private participant-only conversation attachments.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conversation-attachments',
  'conversation-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Paths are always <conversation-id>/<message-id>/<random-uuid>/<sanitized-name>.
-- Guard the UUID cast so malformed object names are denied rather than raising.
create policy conversation_attachments_select_participant
on storage.objects for select to authenticated
using (
  bucket_id = 'conversation-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = split_part(name, '/', 1)::uuid
      and participant.user_id = auth.uid()
  )
);

create policy conversation_attachments_insert_participant
on storage.objects for insert to authenticated
with check (
  bucket_id = 'conversation-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = split_part(name, '/', 1)::uuid
      and participant.user_id = auth.uid()
  )
);

create policy conversation_attachments_update_participant
on storage.objects for update to authenticated
using (
  bucket_id = 'conversation-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = split_part(name, '/', 1)::uuid
      and participant.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'conversation-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = split_part(name, '/', 1)::uuid
      and participant.user_id = auth.uid()
  )
);

create policy conversation_attachments_delete_participant
on storage.objects for delete to authenticated
using (
  bucket_id = 'conversation-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = split_part(name, '/', 1)::uuid
      and participant.user_id = auth.uid()
  )
);

create or replace function public.create_conversation_attachment_message(
  target_conversation_id uuid,
  attachment_kind public.message_kind,
  message_nonce uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  created_message_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if attachment_kind not in ('IMAGE'::public.message_kind, 'FILE'::public.message_kind) then
    raise exception 'Attachment messages must be IMAGE or FILE' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = current_user_id
  ) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.conversations conversation
    where conversation.id = target_conversation_id
      and conversation.status <> 'OPEN'::public.conversation_status
  ) or exists (
    select 1 from public.user_blocks block
    where block.conversation_id = target_conversation_id
      and (block.blocker_user_id = current_user_id or block.blocked_user_id = current_user_id)
  ) then
    raise exception 'Conversation does not accept new messages' using errcode = '42501';
  end if;

  select message.id into created_message_id
  from public.messages message
  where message.conversation_id = target_conversation_id
    and message.client_nonce = message_nonce;

  if created_message_id is not null then
    if not exists (
      select 1 from public.messages message
      where message.id = created_message_id
        and message.sender_user_id = current_user_id
        and message.kind = attachment_kind
    ) then
      raise exception 'Nonce conflicts with another message' using errcode = '23505';
    end if;
    return created_message_id;
  end if;

  insert into public.messages (conversation_id, sender_user_id, kind, body, client_nonce)
  values (target_conversation_id, current_user_id, attachment_kind, null, message_nonce)
  returning id into created_message_id;

  update public.conversations
  set last_message_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = target_conversation_id;

  return created_message_id;
end;
$$;

create or replace function public.register_conversation_attachment(
  target_message_id uuid,
  object_path text,
  attachment_mime_type text,
  attachment_size_bytes integer,
  attachment_original_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation_id uuid;
  target_kind public.message_kind;
  attachment_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select message.conversation_id, message.kind
    into target_conversation_id, target_kind
  from public.messages message
  where message.id = target_message_id
    and message.sender_user_id = current_user_id;

  if target_conversation_id is null then
    raise exception 'Message not found or not owned by sender' using errcode = '42501';
  end if;

  if target_kind not in ('IMAGE'::public.message_kind, 'FILE'::public.message_kind) then
    raise exception 'Message kind does not accept attachments' using errcode = '22023';
  end if;

  if object_path is null
     or char_length(object_path) > 1024
     or object_path not like target_conversation_id::text || '/' || target_message_id::text || '/%' then
    raise exception 'Invalid attachment object path' using errcode = '22023';
  end if;

  if attachment_size_bytes is null or attachment_size_bytes < 1 or attachment_size_bytes > 10485760 then
    raise exception 'Invalid attachment size' using errcode = '22023';
  end if;

  if attachment_original_name is null
     or char_length(btrim(attachment_original_name)) < 1
     or char_length(btrim(attachment_original_name)) > 180 then
    raise exception 'Invalid attachment name' using errcode = '22023';
  end if;

  if target_kind = 'IMAGE'::public.message_kind then
    if attachment_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Unsupported image type' using errcode = '22023';
    end if;
  else
    if attachment_mime_type not in (
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) then
      raise exception 'Unsupported file type' using errcode = '22023';
    end if;
  end if;

  if (select count(*) from public.message_attachments attachment where attachment.message_id = target_message_id) >= 4 then
    raise exception 'Attachment limit reached' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'conversation-attachments'
      and object.name = object_path
  ) then
    raise exception 'Uploaded object not found' using errcode = 'P0002';
  end if;

  insert into public.message_attachments (
    message_id,
    storage_path,
    mime_type,
    size_bytes,
    original_name
  ) values (
    target_message_id,
    object_path,
    attachment_mime_type,
    attachment_size_bytes,
    btrim(attachment_original_name)
  )
  returning id into attachment_id;

  return attachment_id;
end;
$$;

revoke all on function public.create_conversation_attachment_message(uuid, public.message_kind, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.create_conversation_attachment_message(uuid, public.message_kind, uuid)
to authenticated, service_role;

revoke all on function public.register_conversation_attachment(uuid, text, text, integer, text)
from public, anon, authenticated, service_role;
grant execute on function public.register_conversation_attachment(uuid, text, text, integer, text)
to authenticated, service_role;
