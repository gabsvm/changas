-- Phase 09 closure: guarded read models required by the operational admin catalog UI.

create or replace function public.list_admin_catalog_categories()
returns table (
  category_id uuid,
  slug text,
  name text,
  description text,
  sort_order smallint,
  is_active boolean,
  skill_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  return query
  select
    c.id,
    c.slug,
    c.name,
    c.description,
    c.sort_order,
    c.is_active,
    (select count(*) from public.skills s where s.category_id = c.id)
  from public.categories c
  order by c.sort_order asc, c.name asc, c.id asc;
end;
$$;

create or replace function public.list_admin_catalog_skills(
  target_category_id uuid default null
)
returns table (
  skill_id uuid,
  category_id uuid,
  category_name text,
  slug text,
  name text,
  description text,
  sort_order smallint,
  is_active boolean,
  service_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  return query
  select
    s.id,
    s.category_id,
    c.name,
    s.slug,
    s.name,
    s.description,
    s.sort_order,
    s.is_active,
    (select count(*) from public.services svc where svc.skill_id = s.id)
  from public.skills s
  join public.categories c on c.id = s.category_id
  where target_category_id is null or s.category_id = target_category_id
  order by c.sort_order asc, c.name asc, s.sort_order asc, s.name asc, s.id asc;
end;
$$;

create or replace function public.list_admin_services(
  search_text text default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  service_id uuid,
  provider_user_id uuid,
  provider_display_name text,
  service_title text,
  service_slug text,
  skill_name text,
  is_published boolean,
  is_paused boolean,
  moderation_state text,
  moderation_reason text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if page_size is null or page_size < 1 or page_size > 100
    or page_offset is null or page_offset < 0 or page_offset > 10000 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select
    svc.id,
    svc.provider_user_id,
    p.display_name,
    svc.title,
    svc.public_slug,
    sk.name,
    svc.is_published,
    svc.is_paused,
    coalesce(sms.state, 'CLEAR')::text,
    sms.reason,
    svc.updated_at
  from public.services svc
  join public.skills sk on sk.id = svc.skill_id
  left join public.profiles p on p.id = svc.provider_user_id
  left join public.service_moderation_state sms on sms.service_id = svc.id
  where nullif(btrim(search_text), '') is null
    or svc.id::text = btrim(search_text)
    or coalesce(svc.title, '') ilike '%' || btrim(search_text) || '%'
    or coalesce(svc.public_slug, '') ilike '%' || btrim(search_text) || '%'
    or coalesce(sk.name, '') ilike '%' || btrim(search_text) || '%'
    or coalesce(p.display_name, '') ilike '%' || btrim(search_text) || '%'
  order by svc.updated_at desc, svc.id desc
  limit page_size
  offset page_offset;
end;
$$;

revoke all on function public.list_admin_catalog_categories()
from public, anon, authenticated, service_role;
revoke all on function public.list_admin_catalog_skills(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_admin_services(text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function public.list_admin_catalog_categories()
to authenticated, service_role;
grant execute on function public.list_admin_catalog_skills(uuid)
to authenticated, service_role;
grant execute on function public.list_admin_services(text, integer, integer)
to authenticated, service_role;
