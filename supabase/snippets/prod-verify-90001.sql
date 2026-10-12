-- Verify 20261013090001 en prod: el guard consulta bloqueos del par.
select pg_get_functiondef(to_regprocedure('public.start_service_conversation(text,text)'))
  like '%user_blocks%' as pair_block_guard;
