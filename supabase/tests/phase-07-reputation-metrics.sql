begin;

select plan(12);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_public_provider_reputation'
  ),
  'public provider reputation summary rpc exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_public_provider_reputation_context'
  ),
  'skill/service contextual reputation rpc exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_public_provider_reviews'
  ),
  'safe public verified review read rpc exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_discovery_services_v4'
  ),
  'reputation-aware discovery v4 rpc exists'
);

select ok(
  coalesce((
    select bool_and(
      has_function_privilege('anon', p.oid, 'EXECUTE')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_public_provider_reputation',
        'list_public_provider_reputation_context',
        'list_public_provider_reviews',
        'search_discovery_services_v4'
      )
    having count(*) = 4
  ), false),
  'public reputation read contracts are available to anonymous and authenticated visitors'
);

select ok(
  not has_table_privilege('anon', 'public.reviews', 'SELECT'),
  'anonymous review browsing does not expose the raw reviews table'
);

select ok(
  not has_table_privilege('anon', 'public.review_reports', 'SELECT'),
  'review report metadata remains private while reviews become publicly readable'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles'
      and column_name in ('reputation_score', 'ranking_score', 'trust_score')
  ),
  'provider profile does not persist an opaque public reputation score'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_profiles'
      and column_name = 'response_time_seconds'
  ),
  'unreliable response-time metric is not fabricated as a provider profile field'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'search_discovery_services_v4'
      and pg_get_function_result(p.oid) ilike '%adjusted_rating%'
      and pg_get_function_result(p.oid) ilike '%review_count%'
      and pg_get_function_result(p.oid) ilike '%completed_jobs%'
  ),
  'discovery v4 exposes understandable reputation card signals'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_public_provider_reputation'
      and pg_get_function_result(p.oid) ilike '%completion_rate%'
      and pg_get_function_result(p.oid) ilike '%cancellation_rate%'
      and pg_get_function_result(p.oid) ilike '%no_show_rate%'
      and pg_get_function_result(p.oid) ilike '%repeat_client_count%'
  ),
  'provider reputation summary exposes operational and repeat-client metrics'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_public_provider_reviews'
      and pg_get_function_result(p.oid) ilike '%service_title%'
      and pg_get_function_result(p.oid) ilike '%skill_name%'
      and pg_get_function_result(p.oid) ilike '%category_name%'
  ),
  'public verified reviews retain service, skill and category context'
);

select * from finish();
rollback;
