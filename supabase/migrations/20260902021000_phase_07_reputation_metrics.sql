-- Phase 07: understandable provider reputation metrics and safe public review reads.
-- No opaque persisted score is introduced. Response time remains omitted until it can be measured reliably.

create or replace function public.provider_reputation_metrics_internal(
  target_provider_id uuid,
  target_service_id uuid default null,
  target_skill_id uuid default null
)
returns table (
  rating_average numeric,
  adjusted_rating numeric,
  review_count bigint,
  quality_rating_average numeric,
  punctuality_rating_average numeric,
  communication_rating_average numeric,
  completed_jobs bigint,
  observed_jobs bigint,
  completion_rate numeric,
  cancellation_count bigint,
  cancellation_rate numeric,
  no_show_count bigint,
  no_show_rate numeric,
  repeat_client_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with review_stats as (
    select
      count(*)::bigint as review_count,
      avg(r.rating::numeric) as rating_average,
      avg(r.quality_rating::numeric) as quality_rating_average,
      avg(r.punctuality_rating::numeric) as punctuality_rating_average,
      avg(r.communication_rating::numeric) as communication_rating_average
    from public.reviews r
    where r.provider_user_id = target_provider_id
      and (target_service_id is null or r.service_id = target_service_id)
      and (target_skill_id is null or r.skill_id = target_skill_id)
  ),
  marketplace_prior as (
    select coalesce(avg(r.rating::numeric), 4.2::numeric) as prior_average
    from public.reviews r
  ),
  filtered_jobs as (
    select j.id, j.client_user_id, j.status
    from public.jobs j
    join public.services s on s.id = j.service_id
    where j.provider_user_id = target_provider_id
      and (target_service_id is null or j.service_id = target_service_id)
      and (target_skill_id is null or s.skill_id = target_skill_id)
  ),
  job_stats as (
    select
      count(*) filter (where status = 'COMPLETED')::bigint as completed_jobs,
      count(*) filter (where status in ('COMPLETED', 'CANCELLED', 'NO_SHOW'))::bigint as observed_jobs,
      count(*) filter (where status = 'CANCELLED')::bigint as cancellation_count,
      count(*) filter (where status = 'NO_SHOW')::bigint as no_show_count
    from filtered_jobs
  ),
  repeat_clients as (
    select count(*)::bigint as repeat_client_count
    from (
      select client_user_id
      from filtered_jobs
      where status = 'COMPLETED'
      group by client_user_id
      having count(*) >= 2
    ) repeated
  )
  select
    case
      when reviews.review_count = 0 then null
      else round(reviews.rating_average, 2)
    end as rating_average,
    case
      when reviews.review_count = 0 then null
      else round(
        (
          reviews.rating_average * reviews.review_count::numeric
          + prior.prior_average * 8::numeric
        ) / (reviews.review_count::numeric + 8::numeric),
        4
      )
    end as adjusted_rating,
    reviews.review_count,
    case
      when reviews.quality_rating_average is null then null
      else round(reviews.quality_rating_average, 2)
    end,
    case
      when reviews.punctuality_rating_average is null then null
      else round(reviews.punctuality_rating_average, 2)
    end,
    case
      when reviews.communication_rating_average is null then null
      else round(reviews.communication_rating_average, 2)
    end,
    jobs.completed_jobs,
    jobs.observed_jobs,
    case
      when jobs.observed_jobs = 0 then null
      else round(jobs.completed_jobs::numeric / jobs.observed_jobs::numeric, 4)
    end as completion_rate,
    jobs.cancellation_count,
    case
      when jobs.observed_jobs = 0 then null
      else round(jobs.cancellation_count::numeric / jobs.observed_jobs::numeric, 4)
    end as cancellation_rate,
    jobs.no_show_count,
    case
      when jobs.observed_jobs = 0 then null
      else round(jobs.no_show_count::numeric / jobs.observed_jobs::numeric, 4)
    end as no_show_rate,
    repeated.repeat_client_count
  from review_stats reviews
  cross join marketplace_prior prior
  cross join job_stats jobs
  cross join repeat_clients repeated;
$$;

revoke all on function public.provider_reputation_metrics_internal(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.get_public_provider_reputation(
  target_provider_slug text
)
returns table (
  provider_slug text,
  rating_average numeric,
  adjusted_rating numeric,
  review_count bigint,
  quality_rating_average numeric,
  punctuality_rating_average numeric,
  communication_rating_average numeric,
  completed_jobs bigint,
  observed_jobs bigint,
  completion_rate numeric,
  cancellation_count bigint,
  cancellation_rate numeric,
  no_show_count bigint,
  no_show_rate numeric,
  repeat_client_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    provider.public_slug,
    metrics.rating_average,
    metrics.adjusted_rating,
    metrics.review_count,
    metrics.quality_rating_average,
    metrics.punctuality_rating_average,
    metrics.communication_rating_average,
    metrics.completed_jobs,
    metrics.observed_jobs,
    metrics.completion_rate,
    metrics.cancellation_count,
    metrics.cancellation_rate,
    metrics.no_show_count,
    metrics.no_show_rate,
    metrics.repeat_client_count
  from public.provider_profiles provider
  cross join lateral public.provider_reputation_metrics_internal(
    provider.user_id,
    null,
    null
  ) metrics
  where provider.public_slug = target_provider_slug
    and provider.status = 'ACTIVE'
    and not provider.marketplace_paused;
$$;

create or replace function public.list_public_provider_reputation_context(
  target_provider_slug text
)
returns table (
  context_type text,
  context_slug text,
  context_name text,
  rating_average numeric,
  adjusted_rating numeric,
  review_count bigint,
  completed_jobs bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with target_provider as (
    select provider.user_id
    from public.provider_profiles provider
    where provider.public_slug = target_provider_slug
      and provider.status = 'ACTIVE'
      and not provider.marketplace_paused
  ),
  skill_context as (
    select distinct skill.id, skill.slug, skill.name
    from target_provider provider
    join public.services service on service.provider_user_id = provider.user_id
    join public.skills skill on skill.id = service.skill_id
  ),
  service_context as (
    select service.id, service.public_slug as slug, service.title as name
    from target_provider provider
    join public.services service on service.provider_user_id = provider.user_id
  )
  select
    'SKILL'::text,
    skill.slug,
    skill.name,
    metrics.rating_average,
    metrics.adjusted_rating,
    metrics.review_count,
    metrics.completed_jobs
  from target_provider provider
  join skill_context skill on true
  cross join lateral public.provider_reputation_metrics_internal(
    provider.user_id,
    null,
    skill.id
  ) metrics
  where metrics.review_count > 0 or metrics.completed_jobs > 0

  union all

  select
    'SERVICE'::text,
    service.slug,
    service.name,
    metrics.rating_average,
    metrics.adjusted_rating,
    metrics.review_count,
    metrics.completed_jobs
  from target_provider provider
  join service_context service on true
  cross join lateral public.provider_reputation_metrics_internal(
    provider.user_id,
    service.id,
    null
  ) metrics
  where metrics.review_count > 0 or metrics.completed_jobs > 0

  order by 1, 7 desc, 6 desc, 2;
$$;

create or replace function public.list_public_provider_reviews(
  target_provider_slug text,
  skill_filter text default null,
  service_filter text default null,
  before_created_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 20
)
returns table (
  review_id uuid,
  reviewer_display_name text,
  rating smallint,
  quality_rating smallint,
  punctuality_rating smallint,
  communication_rating smallint,
  review_text text,
  service_title text,
  service_slug text,
  skill_name text,
  skill_slug text,
  category_name text,
  category_slug text,
  provider_reply text,
  provider_replied_at timestamptz,
  created_at timestamptz,
  has_more boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  bounded_page_size integer := least(greatest(coalesce(page_size, 20), 1), 50);
begin
  return query
  with eligible as (
    select
      review.id as review_id,
      reviewer.display_name as reviewer_display_name,
      review.rating,
      review.quality_rating,
      review.punctuality_rating,
      review.communication_rating,
      review.review_text,
      review.service_title_snapshot as service_title,
      service.public_slug as service_slug,
      review.skill_name_snapshot as skill_name,
      skill.slug as skill_slug,
      review.category_name_snapshot as category_name,
      category.slug as category_slug,
      reply.reply_text as provider_reply,
      reply.updated_at as provider_replied_at,
      review.created_at
    from public.reviews review
    join public.provider_profiles provider
      on provider.user_id = review.provider_user_id
    join public.profiles reviewer
      on reviewer.id = review.reviewer_user_id
    join public.services service
      on service.id = review.service_id
    join public.skills skill
      on skill.id = review.skill_id
    join public.categories category
      on category.id = review.category_id
    left join public.review_replies reply
      on reply.review_id = review.id
    where provider.public_slug = target_provider_slug
      and provider.status = 'ACTIVE'
      and not provider.marketplace_paused
      and (skill_filter is null or skill.slug = skill_filter)
      and (service_filter is null or service.public_slug = service_filter)
      and (
        before_created_at is null
        or review.created_at < before_created_at
        or (
          review.created_at = before_created_at
          and before_id is not null
          and review.id < before_id
        )
      )
    order by review.created_at desc, review.id desc
    limit bounded_page_size + 1
  ),
  paged as (
    select
      eligible.*,
      row_number() over (order by eligible.created_at desc, eligible.review_id desc) as page_row,
      count(*) over () > bounded_page_size as page_has_more
    from eligible
  )
  select
    paged.review_id,
    paged.reviewer_display_name,
    paged.rating,
    paged.quality_rating,
    paged.punctuality_rating,
    paged.communication_rating,
    paged.review_text,
    paged.service_title,
    paged.service_slug,
    paged.skill_name,
    paged.skill_slug,
    paged.category_name,
    paged.category_slug,
    paged.provider_reply,
    paged.provider_replied_at,
    paged.created_at,
    paged.page_has_more
  from paged
  where paged.page_row <= bounded_page_size
  order by paged.created_at desc, paged.review_id desc;
end;
$$;

revoke all on function public.get_public_provider_reputation(text)
from public, anon, authenticated, service_role;
grant execute on function public.get_public_provider_reputation(text)
to anon, authenticated, service_role;

revoke all on function public.list_public_provider_reputation_context(text)
from public, anon, authenticated, service_role;
grant execute on function public.list_public_provider_reputation_context(text)
to anon, authenticated, service_role;

revoke all on function public.list_public_provider_reviews(text, text, text, timestamptz, uuid, integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_public_provider_reviews(text, text, text, timestamptz, uuid, integer)
to anon, authenticated, service_role;
