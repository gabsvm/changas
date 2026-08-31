begin;

select plan(10);

select ok(
  to_regclass('public.conversations') is not null,
  'conversations table exists'
);
select ok(
  to_regclass('public.conversation_participants') is not null,
  'conversation participants table exists'
);
select ok(
  to_regclass('public.messages') is not null,
  'messages table exists'
);
select ok(
  to_regclass('public.message_attachments') is not null,
  'message attachments table exists'
);
select ok(
  to_regclass('public.conversation_reads') is not null,
  'conversation read cursors table exists'
);
select ok(
  to_regclass('public.user_blocks') is not null,
  'user blocks table exists'
);
select ok(
  to_regclass('public.conversation_reports') is not null,
  'conversation reports table exists'
);
select ok(
  to_regclass('public.conversation_moderation_events') is not null,
  'conversation moderation events table exists'
);
select ok(
  to_regclass('public.messages') is not null
  and (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'messages keep RLS enabled'
);
select ok(
  to_regclass('public.conversations') is not null
  and (select relrowsecurity from pg_class where oid = 'public.conversations'::regclass),
  'conversations keep RLS enabled'
);

select * from finish();
rollback;
