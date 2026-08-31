begin;

select plan(8);

select ok(
  exists (select 1 from storage.buckets where id = 'conversation-attachments'),
  'private conversation attachment bucket exists'
);
select ok(
  not (select public from storage.buckets where id = 'conversation-attachments'),
  'conversation attachment bucket is private'
);
select is(
  (select file_size_limit::bigint from storage.buckets where id = 'conversation-attachments'),
  10485760::bigint,
  'conversation attachment bucket limits objects to 10 MiB'
);
select ok(
  to_regprocedure('public.create_conversation_attachment_message(uuid,public.message_kind,uuid)') is not null,
  'attachment message creation RPC exists'
);
select ok(
  to_regprocedure('public.register_conversation_attachment(uuid,text,text,integer,text)') is not null,
  'attachment metadata registration RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.register_conversation_attachment(uuid,text,text,integer,text)', 'EXECUTE'),
  'anonymous users cannot register conversation attachments'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'conversation_attachments_%'),
  4,
  'conversation attachment storage has participant-scoped CRUD policies'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'conversation_attachments_%'
      and 'anon' = any(roles)
  ),
  'conversation attachment policies never grant anonymous access'
);

select * from finish();
rollback;
