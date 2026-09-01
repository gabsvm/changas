begin;

select plan(14);

select ok(
  to_regclass('public.availability_rules') is not null,
  'availability rules table exists'
);
select ok(
  to_regclass('public.availability_blocks') is not null,
  'availability exception blocks table exists'
);
select ok(
  to_regclass('public.provider_slot_holds') is not null,
  'temporary provider slot holds table exists'
);

select ok(
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.availability_rules')), false),
  'availability rules keep RLS enabled'
);
select ok(
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.availability_blocks')), false),
  'availability blocks keep RLS enabled'
);
select ok(
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.provider_slot_holds')), false),
  'provider slot holds keep RLS enabled'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_provider_availability_rule'
  ),
  'provider availability rule RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_provider_availability_rule'
  ),
  'provider availability rule deletion RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_provider_availability_block'
  ),
  'provider availability block RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_provider_availability_block'
  ),
  'provider availability block deletion RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'hold_proposal_slot'
  ),
  'proposal slot hold RPC exists'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'release_proposal_slot_hold'
  ),
  'proposal slot hold release RPC exists'
);

select ok(
  not coalesce(has_table_privilege('authenticated', 'public.availability_rules', 'INSERT, UPDATE, DELETE'), false)
  and not coalesce(has_table_privilege('authenticated', 'public.availability_blocks', 'INSERT, UPDATE, DELETE'), false)
  and not coalesce(has_table_privilege('authenticated', 'public.provider_slot_holds', 'INSERT, UPDATE, DELETE'), false),
  'authenticated scheduling tables are mutation-safe'
);

select ok(
  not coalesce(has_table_privilege('anon', 'public.availability_rules', 'SELECT'), false)
  and not coalesce(has_table_privilege('anon', 'public.availability_blocks', 'SELECT'), false)
  and not coalesce(has_table_privilege('anon', 'public.provider_slot_holds', 'SELECT'), false),
  'anonymous users cannot inspect provider scheduling internals'
);

select * from finish();
rollback;
