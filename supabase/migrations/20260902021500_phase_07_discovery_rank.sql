-- Phase 07: reputation-aware public discovery contract.
-- V3 remains available for compatibility; V4 adds understandable reputation fields and ranking sorts.

create or replace function public.search_discovery_services_v4(
  query_text text default null,
  category_filter text default null,
  skill_filter text default null,
  modality_filter public.service_modality default null,
  min_price bigint default null,
  max_price bigint default null,
  accepts_offers_filter boolean default null,
  price_model_filter public.price_model default null,
  origin_lat numeric default null,
  origin_lng numeric default null,
  radius_meters integer default null,
  sort_key text default 'recommended',
  page_number integer default 1,
  page_size integer default 24
)
returns table (
  provider_display_name text,
  provider_avatar_url text,
  provider_slug text,
  provider_zone text,
  service_title text,
  service_slug text,
  category_slug text,
  category_name text,
  skill_slug text,
  skill_name text,
  modality public.service_modality,
  price_model public.price_model,
  price_amount bigint,
  currency_code text,
  price_unit text,
  accepts_offers boolean,
  distance_bucket text,
  rating_average numeric,
  adjusted_rating numeric,
  review_count bigint,
  completed_jobs bigint,
  completion_rate numeric,
  repeat_client_count bigint,
  relevance numeric,
  has_more boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized_query text := public.normalize_search_text(query_text);
  origin_point extensions.geography;
  effective_radius integer;
begin
  if page_number < 1 or page_number > 1000 or page_size < 1 or page_size > 24 then
    raise exception 'invalid discovery pagination'
      using errcode = '22023';
  end if;

  if char_length(coalesce(query_text, '')) > 120 then
    raise exception 'discovery query is too long'
      using errcode = '22023';
  end if;

  if sort_key not in (
    'recommended',
    'nearest',
    'price-asc',
    'price-desc',
    'best-rated',
    'most-completed'
  ) then
    raise exception 'invalid discovery sort'
      using errcode = '22023';
  end if;

  if min_price is not null and min_price < 0 then
    raise exception 'invalid minimum price'
      using errcode = '22023';
  end if;
  if max_price is not null and max_price < 0 then
    raise exception 'invalid maximum price'
      using errcode = '22023';
  end if;
  if min_price is not null and max_price is not null and min_price > max_price then
    raise exception 'minimum price exceeds maximum price'
      using errcode = '22023';
  end if;

  if (origin_lat is null) <> (origin_lng is null) then
    raise exception 'a discovery point needs latitude and longitude'
      using errcode = '22023';
  end if;
  if origin_lat is not null and (origin_lat < -90 or origin_lat > 90) then
    raise exception 'invalid discovery latitude'
      using errcode = '22023';
  end if;
  if origin_lng is not null and (origin_lng < -180 or origin_lng > 180) then
    raise exception 'invalid discovery longitude'
      using errcode = '22023';
  end if;
  if radius_meters is not null and (radius_meters < 100 or radius_meters > 100000) then
    raise exception 'invalid discovery radius'
      using errcode = '22023';
  end if;

  if origin_lat is not null then
    origin_point := extensions.st_setsrid(
      extensions.st_makepoint(origin_lng::double precision, origin_lat::double precision),
      4326
    )::extensions.geography;
  end if;
  effective_radius := coalesce(radius_meters, 10000);

  return query
  with query_data as (
    select
      normalized_query as normalized_query,
      case
        when normalized_query is null or normalized_query = '' then null::tsquery
        else plainto_tsquery('simple', normalized_query)
      end as query_vector
  ),
  eligible as (
    select
      profile.display_name,
      profile.avatar_url,
      provider.public_slug,
      profile.public_zone,
      service.title,
      service.public_slug as service_public_slug,
      category.slug as service_category_slug,
      category.name as service_category_name,
      skill.slug as service_skill_slug,
      skill.name as service_skill_name,
      service.modality as service_modality,
      service.price_model as service_price_model,
      service.price_amount as service_price_amount,
      service.currency_code as service_currency_code,
      service.price_unit as service_price_unit,
      service.accepts_offers as service_accepts_offers,
      area.distance_meters,
      (
        provider.created_at >= timezone('utc', now()) - interval '30 days'
        and reputation.completed_jobs = 0
      ) as new_provider_exposure,
      reputation.rating_average,
      reputation.adjusted_rating,
      reputation.review_count,
      reputation.completed_jobs,
      reputation.completion_rate,
      reputation.repeat_client_count,
      q.normalized_query,
      q.query_vector,
      matches.exact_skill_match,
      matches.exact_category_match,
      matches.synonym_match,
      matches.tag_match,
      coalesce(ts_rank_cd(service.search_document, q.query_vector), 0)::numeric as text_relevance,
      matches.fuzzy_match
    from public.services service
    join public.provider_profiles provider
      on provider.user_id = service.provider_user_id
    join public.profiles profile
      on profile.id = provider.user_id
    join public.skills skill
      on skill.id = service.skill_id and skill.is_active
    join public.categories category
      on category.id = skill.category_id and category.is_active
    cross join query_data q
    cross join lateral public.provider_reputation_metrics_internal(
      provider.user_id,
      null,
      skill.id
    ) reputation
    join lateral (
      select
        (
          public.normalize_search_text(skill.slug) = q.normalized_query
          or public.normalize_search_text(skill.name) = q.normalized_query
        ) as exact_skill_match,
        (
          public.normalize_search_text(category.slug) = q.normalized_query
          or public.normalize_search_text(category.name) = q.normalized_query
        ) as exact_category_match,
        exists (
          select 1
          from public.skill_synonyms synonym
          where synonym.skill_id = skill.id
            and public.normalize_search_text(synonym.normalized_phrase) = q.normalized_query
        ) as synonym_match,
        exists (
          select 1
          from public.service_tags tag
          where tag.service_id = service.id
            and public.normalize_search_text(tag.normalized_tag) = q.normalized_query
        ) as tag_match,
        (
          public.normalize_search_text(skill.slug) = q.normalized_query
          or public.normalize_search_text(skill.name) = q.normalized_query
          or public.normalize_search_text(category.slug) = q.normalized_query
          or public.normalize_search_text(category.name) = q.normalized_query
          or service.search_text_normalized operator(extensions.%) q.normalized_query
          or extensions.similarity(
            public.normalize_search_text(skill.name),
            q.normalized_query
          ) >= 0.28
        ) as fuzzy_match
    ) matches on true
    left join lateral (
      select min(
        extensions.st_distance(service_area.public_search_center, origin_point)
      )::integer as distance_meters
      from public.service_areas service_area
      where origin_point is not null
        and service_area.provider_user_id = provider.user_id
        and service_area.is_active
        and extensions.st_dwithin(
          service_area.public_search_center,
          origin_point,
          effective_radius
        )
        and extensions.st_dwithin(
          service_area.public_search_center,
          origin_point,
          service_area.radius_meters
        )
    ) area on true
    where provider.status = 'ACTIVE'
      and not provider.marketplace_paused
      and service.is_published
      and not service.is_paused
      and (category_filter is null or category.slug = category_filter)
      and (skill_filter is null or skill.slug = skill_filter)
      and (
        modality_filter is null
        or (modality_filter = 'IN_PERSON' and service.modality in ('IN_PERSON', 'BOTH'))
        or (modality_filter = 'REMOTE' and service.modality in ('REMOTE', 'BOTH'))
      )
      and (
        min_price is null
        or (service.price_amount is not null and service.price_amount >= min_price)
      )
      and (
        max_price is null
        or (service.price_amount is not null and service.price_amount <= max_price)
      )
      and (
        accepts_offers_filter is null
        or service.accepts_offers = accepts_offers_filter
      )
      and (price_model_filter is null or service.price_model = price_model_filter)
      and (
        origin_point is null
        or service.modality in ('REMOTE', 'BOTH')
        or area.distance_meters is not null
      )
      and (
        q.normalized_query is null
        or q.normalized_query = ''
        or service.search_document @@ q.query_vector
        or matches.exact_skill_match
        or matches.exact_category_match
        or matches.synonym_match
        or matches.tag_match
        or matches.fuzzy_match
      )
  ),
  scored as (
    select
      eligible.*,
      (
        least(greatest(eligible.text_relevance, 0), 1) * 1.5
        + case when eligible.exact_skill_match then 0.45 else 0 end
        + case when eligible.exact_category_match then 0.25 else 0 end
        + case when eligible.tag_match then 0.15 else 0 end
        + case when eligible.synonym_match then 0.2 else 0 end
        + case
            when eligible.distance_meters is null then 0
            else greatest(
              0::numeric,
              0.2 - least(eligible.distance_meters, 20000)::numeric / 100000
            )
          end
        + case
            when eligible.review_count > 0 and eligible.adjusted_rating is not null
              then ((least(greatest(eligible.adjusted_rating, 1), 5) - 1) / 4) * 0.18
            else 0
          end
        + least(eligible.completed_jobs, 20::bigint)::numeric / 20 * 0.12
        + coalesce(eligible.completion_rate, 0) * 0.08
        + least(eligible.repeat_client_count, 10::bigint)::numeric / 10 * 0.04
        + case when eligible.new_provider_exposure then 0.04 else 0 end
      )::numeric as discovery_relevance
    from eligible
  ),
  ordered as (
    select scored.*
    from scored
    where (
      origin_point is null
      or modality_filter is distinct from 'IN_PERSON'
      or scored.distance_meters is not null
    )
    order by
      case when sort_key = 'recommended' then scored.discovery_relevance end desc nulls last,
      case when sort_key = 'nearest' then scored.distance_meters end asc nulls last,
      case when sort_key = 'price-asc' then scored.service_price_amount end asc nulls last,
      case when sort_key = 'price-desc' then scored.service_price_amount end desc nulls last,
      case when sort_key = 'best-rated' then scored.adjusted_rating end desc nulls last,
      case when sort_key = 'best-rated' then scored.review_count end desc nulls last,
      case when sort_key = 'most-completed' then scored.completed_jobs end desc nulls last,
      case when sort_key = 'most-completed' then scored.adjusted_rating end desc nulls last,
      case
        when sort_key in ('best-rated', 'most-completed')
          then scored.discovery_relevance
      end desc nulls last,
      scored.public_slug,
      scored.service_public_slug
    limit page_size + 1
    offset (page_number - 1) * page_size
  ),
  paged as (
    select
      ordered.*,
      row_number() over () as page_row,
      count(*) over () > page_size as page_has_more
    from ordered
  )
  select
    paged.display_name,
    paged.avatar_url,
    paged.public_slug,
    paged.public_zone,
    paged.title,
    paged.service_public_slug,
    paged.service_category_slug,
    paged.service_category_name,
    paged.service_skill_slug,
    paged.service_skill_name,
    paged.service_modality,
    paged.service_price_model,
    paged.service_price_amount,
    paged.service_currency_code,
    paged.service_price_unit,
    paged.service_accepts_offers,
    case
      when paged.distance_meters is null then null
      when paged.distance_meters < 2000 then 'UNDER_2_KM'
      when paged.distance_meters < 5000 then 'KM_2_TO_5'
      when paged.distance_meters < 10000 then 'KM_5_TO_10'
      when paged.distance_meters < 25000 then 'KM_10_TO_25'
      else 'OVER_25_KM'
    end,
    paged.rating_average,
    paged.adjusted_rating,
    paged.review_count,
    paged.completed_jobs,
    paged.completion_rate,
    paged.repeat_client_count,
    paged.discovery_relevance,
    paged.page_has_more
  from paged
  where paged.page_row <= page_size;
end;
$$;

revoke all on function public.search_discovery_services_v4(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) from public, anon, authenticated, service_role;

grant execute on function public.search_discovery_services_v4(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) to anon, authenticated, service_role;
