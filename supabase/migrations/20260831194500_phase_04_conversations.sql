-- Phase 04: contextual participant-only conversations.
-- This migration establishes the durable chat/evidence model only. Message
-- mutation RPCs, private Storage and Realtime are added incrementally later.

create type public.conversation_status as enum (
  'OPEN',
  'BLOCKED',
  'CLOSED'
);

create type public.message_kind as enum (
  'TEXT',
  'IMAGE',
  'FILE',
  'SYSTEM'
);

create type public.conversation_participant_role as enum (
  'CLIENT',
  'PROVIDER'
);

create table public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  status public.conversation_status not null default 'OPEN',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_message_at timestamptz,
  unique (service_id, client_user_id, provider_user_id),
  check (client_user_id <> provider_user_id)
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.conversation_participant_role not null,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, user_id),
  unique (conversation_id, role)
);

create table public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete restrict,
  kind public.message_kind not null,
  body text,
  client_nonce uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, client_nonce),
  check (
    (kind = 'SYSTEM' and sender_user_id is null)
    or (kind <> 'SYSTEM' and sender_user_id is not null)
  ),
  check (
    (kind = 'TEXT' and body is not null and char_length(btrim(body)) between 1 and 4000)
    or (kind <> 'TEXT' and (body is null or char_length(body) <= 4000))
  )
);

create table public.message_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 1024),
  mime_type text not null check (char_length(mime_type) between 3 and 160),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 180),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, user_id)
);

create table public.user_blocks (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table public.conversation_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (char_length(btrim(category)) between 2 and 80),
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 2000),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.conversation_moderation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (char_length(btrim(event_type)) between 2 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index conversations_client_updated_idx
on public.conversations (client_user_id, updated_at desc, id desc);

create index conversations_provider_updated_idx
on public.conversations (provider_user_id, updated_at desc, id desc);

create index messages_conversation_created_idx
on public.messages (conversation_id, created_at desc, id desc);

create index message_attachments_message_idx
on public.message_attachments (message_id, created_at, id);

create index conversation_reports_conversation_idx
on public.conversation_reports (conversation_id, created_at desc, id desc);

create index conversation_moderation_events_conversation_idx
on public.conversation_moderation_events (conversation_id, created_at desc, id desc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversation_reports enable row level security;
alter table public.conversation_moderation_events enable row level security;

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_participant(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_conversation_participant(uuid)
to authenticated, service_role;

create policy conversations_select_participant
on public.conversations for select to authenticated
using (public.is_conversation_participant(id));

create policy conversation_participants_select_participant
on public.conversation_participants for select to authenticated
using (public.is_conversation_participant(conversation_id));

create policy messages_select_participant
on public.messages for select to authenticated
using (public.is_conversation_participant(conversation_id));

create policy message_attachments_select_participant
on public.message_attachments for select to authenticated
using (
  exists (
    select 1
    from public.messages message
    where message.id = message_attachments.message_id
      and public.is_conversation_participant(message.conversation_id)
  )
);

create policy conversation_reads_select_own
on public.conversation_reads for select to authenticated
using (
  user_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

create policy user_blocks_select_own
on public.user_blocks for select to authenticated
using (
  blocker_user_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

create policy conversation_reports_select_participant
on public.conversation_reports for select to authenticated
using (public.is_conversation_participant(conversation_id));

create policy conversation_moderation_events_select_participant
on public.conversation_moderation_events for select to authenticated
using (public.is_conversation_participant(conversation_id));

revoke all privileges on table public.conversations from public, anon, authenticated;
revoke all privileges on table public.conversation_participants from public, anon, authenticated;
revoke all privileges on table public.messages from public, anon, authenticated;
revoke all privileges on table public.message_attachments from public, anon, authenticated;
revoke all privileges on table public.conversation_reads from public, anon, authenticated;
revoke all privileges on table public.user_blocks from public, anon, authenticated;
revoke all privileges on table public.conversation_reports from public, anon, authenticated;
revoke all privileges on table public.conversation_moderation_events from public, anon, authenticated;

grant select on table public.conversations to authenticated;
grant select on table public.conversation_participants to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.message_attachments to authenticated;
grant select on table public.conversation_reads to authenticated;
grant select on table public.user_blocks to authenticated;
grant select on table public.conversation_reports to authenticated;
grant select on table public.conversation_moderation_events to authenticated;

grant select, insert, update, delete on table public.conversations to service_role;
grant select, insert, update, delete on table public.conversation_participants to service_role;
grant select, insert, update, delete on table public.messages to service_role;
grant select, insert, update, delete on table public.message_attachments to service_role;
grant select, insert, update, delete on table public.conversation_reads to service_role;
grant select, insert, update, delete on table public.user_blocks to service_role;
grant select, insert, update, delete on table public.conversation_reports to service_role;
grant select, insert, update, delete on table public.conversation_moderation_events to service_role;
