-- Phase 03 final audit hardening. Published migrations remain immutable.

-- Public discovery uses a deliberately coarse 0.01-degree (~1.1 km) grid.
-- The precise service_areas.center remains owner/admin data and is never used
-- as a public discovery oracle or returned to clients.
create or replace function public.coarsen_service_area_center(
  precise_center extensions.geography
)
returns extensions.geography
language sql
immutable
strict
set search_path = pg_catalog, public, extensions
as $$
  select extensions.st_setsrid(
    extensions.st_makepoint(
      floor((extensions.st_x(precise_center::geometry) * 100)::numeric) / 100 + 0.005,
      floor((extensions.st_y(precise_center::geometry) * 100)::numeric) / 100 + 0.005
    ),
    4326
  )::extensions.geography;
$$;

alter table public.service_areas
  add column if not exists public_search_center extensions.geography(POINT, 4326);

update public.service_areas
set public_search_center = public.coarsen_service_area_center(center)
where public_search_center is null;

alter table public.service_areas
  alter column public_search_center set not null;

create or replace function public.sync_public_search_center()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  new.public_search_center := public.coarsen_service_area_center(new.center);
  return new;
end;
$$;

drop trigger if exists service_areas_sync_public_search_center on public.service_areas;
create trigger service_areas_sync_public_search_center
before insert or update of center on public.service_areas
for each row execute function public.sync_public_search_center();

create index if not exists service_areas_public_search_center_gist_idx
on public.service_areas using gist (public_search_center);

drop function if exists public.search_discovery_services(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
);
drop function if exists public.search_discovery_services_v2(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
);

create or replace function public.search_discovery_services_v2(
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
  distance_meters integer,
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

  if sort_key not in ('recommended', 'nearest', 'price-asc', 'price-desc') then
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
      p.display_name,
      p.avatar_url,
      pp.public_slug,
      p.public_zone,
      s.title,
      s.public_slug as service_public_slug,
      c.slug as service_category_slug,
      c.name as service_category_name,
      sk.slug as service_skill_slug,
      sk.name as service_skill_name,
      s.modality as service_modality,
      s.price_model as service_price_model,
      s.price_amount as service_price_amount,
      s.currency_code as service_currency_code,
      s.price_unit as service_price_unit,
      s.accepts_offers as service_accepts_offers,
      area.distance_meters,
      (pp.created_at >= timezone('utc', now()) - interval '30 days') as new_provider_exposure,
      q.normalized_query,
      q.query_vector,
      matches.exact_skill_match,
      matches.exact_category_match,
      matches.synonym_match,
      matches.tag_match,
      coalesce(ts_rank_cd(s.search_document, q.query_vector), 0)::numeric as text_relevance,
      matches.fuzzy_match
    from public.services s
    join public.provider_profiles pp on pp.user_id = s.provider_user_id
    join public.profiles p on p.id = pp.user_id
    join public.skills sk on sk.id = s.skill_id and sk.is_active
    join public.categories c on c.id = sk.category_id and c.is_active
    cross join query_data q
    join lateral (
      select
        (public.normalize_search_text(sk.slug) = q.normalized_query
          or public.normalize_search_text(sk.name) = q.normalized_query) as exact_skill_match,
        (public.normalize_search_text(c.slug) = q.normalized_query
          or public.normalize_search_text(c.name) = q.normalized_query) as exact_category_match,
        exists (
          select 1
          from public.skill_synonyms synonym
          where synonym.skill_id = sk.id
            and public.normalize_search_text(synonym.normalized_phrase) = q.normalized_query
        ) as synonym_match,
        exists (
          select 1
          from public.service_tags tag
          where tag.service_id = s.id
            and public.normalize_search_text(tag.normalized_tag) = q.normalized_query
        ) as tag_match,
        (
          public.normalize_search_text(sk.slug) = q.normalized_query
          or public.normalize_search_text(sk.name) = q.normalized_query
          or public.normalize_search_text(c.slug) = q.normalized_query
          or public.normalize_search_text(c.name) = q.normalized_query
          or s.search_text_normalized OPERATOR(extensions.%) q.normalized_query
          or extensions.similarity(public.normalize_search_text(sk.name), q.normalized_query) >= 0.28
        ) as fuzzy_match
    ) matches on true
    left join lateral (
      select min(extensions.st_distance(a.public_search_center, origin_point))::integer as distance_meters
      from public.service_areas a
      where origin_point is not null
        and a.provider_user_id = pp.user_id
        and a.is_active
        and extensions.st_dwithin(a.public_search_center, origin_point, effective_radius)
        and extensions.st_dwithin(a.public_search_center, origin_point, a.radius_meters)
    ) area on true
    where pp.status = 'ACTIVE'
      and not pp.marketplace_paused
      and s.is_published
      and not s.is_paused
      and (category_filter is null or c.slug = category_filter)
      and (skill_filter is null or sk.slug = skill_filter)
      and (modality_filter is null
        or (modality_filter = 'IN_PERSON' and s.modality in ('IN_PERSON', 'BOTH'))
        or (modality_filter = 'REMOTE' and s.modality in ('REMOTE', 'BOTH')))
      and (min_price is null or (s.price_amount is not null and s.price_amount >= min_price))
      and (max_price is null or (s.price_amount is not null and s.price_amount <= max_price))
      and (accepts_offers_filter is null or s.accepts_offers = accepts_offers_filter)
      and (price_model_filter is null or s.price_model = price_model_filter)
      and (
        origin_point is null
        or s.modality in ('REMOTE', 'BOTH')
        or area.distance_meters is not null
      )
      and (
        q.normalized_query is null
        or q.normalized_query = ''
        or s.search_document @@ q.query_vector
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
            else greatest(0::numeric, 0.2 - least(eligible.distance_meters, 20000)::numeric / 100000)
          end
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
    paged.distance_meters,
    paged.discovery_relevance,
    paged.page_has_more
  from paged
  where paged.page_row <= page_size;
end;
$$;


-- v2 remains an internal implementation: its coarse meter value is never granted
-- to public roles. The public v3 contract exposes only distance buckets.
revoke all on function public.search_discovery_services_v2(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) from public, anon, authenticated, service_role;

create or replace function public.search_discovery_services_v3(
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
  relevance numeric,
  has_more boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select
    result.provider_display_name,
    result.provider_avatar_url,
    result.provider_slug,
    result.provider_zone,
    result.service_title,
    result.service_slug,
    result.category_slug,
    result.category_name,
    result.skill_slug,
    result.skill_name,
    result.modality,
    result.price_model,
    result.price_amount,
    result.currency_code,
    result.price_unit,
    result.accepts_offers,
    case
      when result.distance_meters is null then null
      when result.distance_meters < 2000 then 'UNDER_2_KM'
      when result.distance_meters < 5000 then 'KM_2_TO_5'
      when result.distance_meters < 10000 then 'KM_5_TO_10'
      when result.distance_meters < 25000 then 'KM_10_TO_25'
      else 'OVER_25_KM'
    end,
    result.relevance,
    result.has_more
  from public.search_discovery_services_v2(
    query_text, category_filter, skill_filter, modality_filter,
    min_price, max_price, accepts_offers_filter, price_model_filter,
    origin_lat, origin_lng, radius_meters, sort_key, page_number, page_size
  ) result;
$$;

revoke all on function public.search_discovery_services_v3(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.search_discovery_services_v3(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) to anon, authenticated, service_role;
