-- Phase 02 audit hardening. This migration is additive and intentionally does
-- not rewrite the already-published provider marketplace migration.

-- Existing Phase 02 rows stored whole ARS amounts. Convert them once before
-- enforcing the minor-unit contract used by all new writes.
do $$
begin
  if exists (
    select 1
    from public.services
    where price_amount is not null
      and price_amount > 90071992547409
  ) then
    raise exception 'existing service price cannot be represented safely in minor units';
  end if;

  update public.services
  set price_amount = price_amount * 100
  where price_amount is not null;
end;
$$;

alter table public.services
  add constraint services_price_amount_minor_units_check
  check (
    price_amount is null
    or price_amount between 1 and 9007199254740991
  );

alter table public.services
  add constraint services_currency_ars_check
  check (currency_code = 'ARS');

alter table public.services
  add constraint services_provider_skill_fk
  foreign key (provider_user_id, skill_id)
  references public.provider_skills (provider_user_id, skill_id)
  on delete restrict;

alter table public.certifications
  add constraint certifications_evidence_path_owner_check
  check (
    evidence_path is null
    or split_part(evidence_path, '/', 1) = provider_user_id::text
  );

alter table public.portfolio_items
  add constraint portfolio_media_path_owner_check
  check (
    media_path is null
    or split_part(media_path, '/', 1) = provider_user_id::text
  );

-- The public portfolio Storage policy must agree with the database ownership
-- invariant. A path in another provider's folder can never become public
-- through forged portfolio metadata.
create or replace function public.is_public_portfolio_media(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portfolio_items p
    join public.provider_profiles pp on pp.user_id = p.provider_user_id
    where p.media_path = object_path
      and split_part(p.media_path, '/', 1) = p.provider_user_id::text
      and p.is_public
      and pp.status = 'ACTIVE'
      and not pp.marketplace_paused
  );
$$;

revoke all on function public.is_public_portfolio_media(text) from public, anon, authenticated;
grant execute on function public.is_public_portfolio_media(text) to anon, authenticated, service_role;

-- Replace the old projections whose published column contracts cannot be
-- changed in place. Their grants are restored explicitly below.
drop view public.public_provider_profiles;
create view public.public_provider_profiles as
select
  pp.public_slug,
  p.display_name,
  p.avatar_url,
  p.public_zone,
  p.bio,
  pp.public_headline
from public.provider_profiles pp
join public.profiles p on p.id = pp.user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused;

drop view public.public_service_tags;
create view public.public_service_tags as
select
  pp.public_slug as provider_slug,
  s.public_slug as service_public_slug,
  st.tag
from public.service_tags st
join public.services s on s.id = st.service_id
join public.provider_profiles pp on pp.user_id = s.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and s.is_published
  and not s.is_paused;

revoke all on table public.public_provider_profiles, public.public_service_tags
from public, anon, authenticated, service_role;
grant select on table public.public_provider_profiles, public.public_service_tags
to anon, authenticated, service_role;

-- Tags are changed atomically through the service workflow. Direct client
-- mutation is removed so callers cannot bypass the count/normalization rules.
create or replace function public.replace_service_tags(
  target_service_id uuid,
  requested_tags text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_count integer;
begin
  if current_setting('request.jwt.claim.role', true) = 'authenticated'
     and not exists (
       select 1
       from public.services
       where id = target_service_id
         and provider_user_id = auth.uid()
     ) then
    raise exception 'service does not belong to the authenticated provider'
      using errcode = '42501';
  elsif current_setting('request.jwt.claim.role', true) not in ('authenticated', 'service_role')
        and session_user not in ('postgres', 'service_role') then
    raise exception 'service tag replacement is restricted to provider or server roles'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(requested_tags), 0) > 8 then
    raise exception 'a service can have at most eight tags'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(requested_tags, array[]::text[])) as values(value)
    where value is null
      or char_length(btrim(value)) not between 2 and 80
  ) then
    raise exception 'service tags must contain between two and eighty characters'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select lower(regexp_replace(btrim(value), '\s+', ' ', 'g')) as normalized_tag
      from unnest(coalesce(requested_tags, array[]::text[])) as values(value)
    ) normalized
    group by normalized_tag
    having count(*) > 1
  ) then
    raise exception 'service tags cannot repeat after normalization'
      using errcode = '23505';
  end if;

  select count(*) into normalized_count
  from unnest(coalesce(requested_tags, array[]::text[])) as values(value);

  if normalized_count > 8 then
    raise exception 'a service can have at most eight tags'
      using errcode = '22023';
  end if;

  delete from public.service_tags
  where service_id = target_service_id;

  insert into public.service_tags (service_id, tag)
  select
    target_service_id,
    lower(regexp_replace(btrim(value), '\s+', ' ', 'g'))
  from unnest(coalesce(requested_tags, array[]::text[])) as values(value);
end;
$$;

revoke all on function public.replace_service_tags(uuid, text[]) from public, anon, authenticated;
grant execute on function public.replace_service_tags(uuid, text[]) to authenticated, service_role;
revoke insert, update, delete on table public.service_tags from authenticated;
grant select on table public.service_tags to authenticated;
