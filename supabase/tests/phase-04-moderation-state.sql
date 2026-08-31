begin;

select plan(3);

select has_function(
  'public',
  'get_my_conversation_block_state',
  array['uuid'],
  'personal conversation block state RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.get_my_conversation_block_state(uuid)', 'EXECUTE'),
  'anonymous cannot inspect block state'
);

select ok(
  has_function_privilege('authenticated', 'public.get_my_conversation_block_state(uuid)', 'EXECUTE'),
  'authenticated callers can inspect their own participant-scoped block state'
);

select * from finish();
rollback;
