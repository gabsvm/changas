-- Phase 03: public discovery/search/SEO read model and provider favorites.
-- This migration intentionally does not alter the published Phase 01/02 files.

create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  select btrim(
    regexp_replace(
      lower(translate(input, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

alter table public.services
  add column if not exists search_title_normalized text generated always as (
    public.normalize_search_text(title)
  ) stored,
  add column if not exists search_document tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_search_text(title)), 'A') ||
    setweight(to_tsvector('simple', public.normalize_search_text(description)), 'B')
  ) stored;

create index if not exists services_search_document_gin_idx
on public.services using gin (search_document);

create index if not exists services_search_text_trgm_idx
on public.services using gin (
  (public.normalize_search_text(title) || ' ' || public.normalize_search_text(description))
  extensions.gin_trgm_ops
);

-- The catalog is controlled data, not generated inventory. These entries make
-- the required V1 discovery phrases meaningful without fabricating reputation.
insert into public.skills (id, category_id, slug, name, description, sort_order)
values (
  '22000000-0000-4000-8000-000000000015',
  '21000000-0000-4000-8000-000000000001',
  'electricista',
  'Electricista',
  'Instalaciones y reparaciones eléctricas del hogar.',
  30
)
on conflict (slug) do nothing;

insert into public.skill_synonyms (skill_id, phrase, normalized_phrase)
values
  ('22000000-0000-4000-8000-000000000003', 'arreglar pc', 'arreglar pc'),
  ('22000000-0000-4000-8000-000000000003', 'pc se apaga', 'pc se apaga'),
  ('22000000-0000-4000-8000-000000000005', 'instalar camara', 'instalar camara'),
  ('22000000-0000-4000-8000-000000000006', 'clases ingles', 'clases ingles'),
  ('22000000-0000-4000-8000-000000000015', 'electricista', 'electricista'),
  ('22000000-0000-4000-8000-000000000015', 'reparaciones electricas', 'reparaciones electricas')
on conflict (skill_id, normalized_phrase) do nothing;

create or replace function public.search_discovery_services(
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
  relevance numeric
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
  effective_radius := coalesce(radius_meters, 100000);

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
      q.normalized_query,
      q.query_vector,
      matches.exact_skill_match,
      matches.exact_category_match,
      matches.synonym_match,
      matches.tag_match,
      coalesce(
        ts_rank_cd(s.search_document, q.query_vector),
        0
      )::numeric as text_relevance,
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
          or extensions.similarity(public.normalize_search_text(s.title), q.normalized_query) >= 0.28
          or extensions.similarity(public.normalize_search_text(s.description), q.normalized_query) >= 0.28
          or extensions.similarity(public.normalize_search_text(sk.name), q.normalized_query) >= 0.28
        ) as fuzzy_match
    ) matches on true
    left join lateral (
      select min(extensions.st_distance(a.center, origin_point))::integer as distance_meters
      from public.service_areas a
      where origin_point is not null
        and a.provider_user_id = pp.user_id
        and a.is_active
        and extensions.st_dwithin(a.center, origin_point, effective_radius)
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
      )::numeric as discovery_relevance
    from eligible
  )
  select
    scored.display_name,
    scored.avatar_url,
    scored.public_slug,
    scored.public_zone,
    scored.title,
    scored.service_public_slug,
    scored.service_category_slug,
    scored.service_category_name,
    scored.service_skill_slug,
    scored.service_skill_name,
    scored.service_modality,
    scored.service_price_model,
    scored.service_price_amount,
    scored.service_currency_code,
    scored.service_price_unit,
    scored.service_accepts_offers,
    scored.distance_meters,
    scored.discovery_relevance
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
  limit page_size
  offset (page_number - 1) * page_size;
end;
$$;

revoke all on function public.normalize_search_text(text) from public, anon, authenticated, service_role;
grant execute on function public.normalize_search_text(text) to anon, authenticated, service_role;
revoke all on function public.search_discovery_services(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.search_discovery_services(
  text, text, text, public.service_modality, bigint, bigint, boolean,
  public.price_model, numeric, numeric, integer, text, integer, integer
) to anon, authenticated, service_role;

create table public.provider_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_user_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, provider_user_id)
);

alter table public.provider_favorites enable row level security;

create policy provider_favorites_select_own
on public.provider_favorites for select to authenticated
using (user_id = (select auth.uid()));

create policy provider_favorites_insert_own
on public.provider_favorites for insert to authenticated
with check (user_id = (select auth.uid()));

create policy provider_favorites_delete_own
on public.provider_favorites for delete to authenticated
using (user_id = (select auth.uid()));

revoke all privileges on table public.provider_favorites from public, anon, authenticated;
grant select, insert, delete on table public.provider_favorites to authenticated;
grant select, insert, update, delete on table public.provider_favorites to service_role;

create or replace function public.set_provider_favorite(
  target_provider_slug text,
  should_favorite boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_user_id uuid := auth.uid();
  target_provider_id uuid;
begin
  if request_user_id is null then
    raise exception 'authentication required for favorites'
      using errcode = '42501';
  end if;

  select user_id into target_provider_id
  from public.provider_profiles
  where public_slug = target_provider_slug
    and status = 'ACTIVE'
    and not marketplace_paused;

  if target_provider_id is null then
    raise exception 'public provider does not exist'
      using errcode = 'P0002';
  end if;

  if should_favorite then
    insert into public.provider_favorites (user_id, provider_user_id)
    values (request_user_id, target_provider_id)
    on conflict (user_id, provider_user_id) do nothing;
  else
    delete from public.provider_favorites
    where user_id = request_user_id
      and provider_user_id = target_provider_id;
  end if;

  return should_favorite;
end;
$$;

create or replace function public.list_my_favorite_providers()
returns table (
  provider_slug text,
  display_name text,
  avatar_url text,
  public_zone text,
  public_headline text,
  bio text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    pp.public_slug,
    p.display_name,
    p.avatar_url,
    p.public_zone,
    pp.public_headline,
    p.bio
  from public.provider_favorites favorite
  join public.provider_profiles pp on pp.user_id = favorite.provider_user_id
  join public.profiles p on p.id = pp.user_id
  where favorite.user_id = auth.uid()
    and pp.status = 'ACTIVE'
    and not pp.marketplace_paused
  order by favorite.created_at desc, pp.public_slug;
$$;

revoke all on function public.set_provider_favorite(text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_provider_favorite(text, boolean) to authenticated;
revoke all on function public.list_my_favorite_providers() from public, anon, authenticated, service_role;
grant execute on function public.list_my_favorite_providers() to authenticated;
