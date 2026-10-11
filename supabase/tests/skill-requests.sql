begin;

select plan(9);

select ok(
  to_regclass('public.skill_requests') is not null,
  'skill requests table exists'
);

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid = 'public.skill_requests'::regclass),
  'skill requests keep RLS enabled'
);

select ok(
  has_table_privilege('authenticated', 'public.skill_requests', 'SELECT, INSERT')
  and not has_table_privilege('authenticated', 'public.skill_requests', 'UPDATE, DELETE'),
  'providers can propose and read their own requests only'
);

select ok(
  to_regprocedure('public.submit_skill_request(text,uuid,text,text,text,public.service_modality,public.price_model,bigint,text)') is not null,
  'skill request submit rpc exists'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.submit_skill_request(text,uuid,text,text,text,public.service_modality,public.price_model,bigint,text)')))
  like '%provider_skills%',
  'submit auto-attaches when the skill already exists'
);

select ok(
  to_regprocedure('public.review_skill_request(uuid,text,uuid,text)') is not null,
  'skill request review rpc exists'
);

select ok(
  (select pg_get_functiondef(to_regprocedure('public.review_skill_request(uuid,text,uuid,text)')))
  like '%require_admin()%',
  'skill request review requires admin'
);

select ok(
  to_regprocedure('public.list_skill_request_queue()') is not null,
  'skill request queue read model exists'
);

select ok(
  not has_function_privilege('anon', 'public.submit_skill_request(text,uuid,text,text,text,public.service_modality,public.price_model,bigint,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_skill_request(text,uuid,text,text,text,public.service_modality,public.price_model,bigint,text)', 'EXECUTE'),
  'skill request submit is authenticated-only'
);

select * from finish();
rollback;
