-- Phase 09 Task 3 completion: operational synonym/tag administration.

create or replace function public.list_admin_skill_synonyms(target_skill_id uuid default null)
returns table (
  synonym_id uuid,
  skill_id uuid,
  skill_name text,
  phrase text,
  normalized_phrase text
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
    ss.id,
    ss.skill_id,
    s.name,
    ss.phrase,
    ss.normalized_phrase
  from public.skill_synonyms ss
  join public.skills s on s.id = ss.skill_id
  where target_skill_id is null or ss.skill_id = target_skill_id
  order by s.name, ss.normalized_phrase, ss.id;
end;
$$;

create or replace function public.list_admin_service_tags(target_service_id uuid default null)
returns table (
  service_id uuid,
  service_title text,
  provider_display_name text,
  tag text,
  normalized_tag text
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
    st.service_id,
    s.title,
    p.display_name,
    st.tag,
    st.normalized_tag
  from public.service_tags st
  join public.services s on s.id = st.service_id
  left join public.profiles p on p.id = s.provider_user_id
  where target_service_id is null or st.service_id = target_service_id
  order by s.title, st.normalized_tag, st.service_id;
end;
$$;

create or replace function public.admin_create_service_tag(
  target_service_id uuid,
  requested_tag text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  created_normalized_tag text;
begin
  perform public.require_admin();

  if target_service_id is null then
    raise exception using errcode = '22023', message = 'service id is required';
  end if;

  insert into public.service_tags (service_id, tag)
  values (target_service_id, btrim(requested_tag))
  returning normalized_tag into created_normalized_tag;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_TAG_CREATED',
    'SERVICE_TAG',
    target_service_id,
    jsonb_build_object(
      'tag', btrim(requested_tag),
      'normalized_tag', created_normalized_tag
    )
  );

  return created_normalized_tag;
end;
$$;

create or replace function public.admin_update_service_tag(
  target_service_id uuid,
  target_normalized_tag text,
  requested_tag text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_tag text;
  updated_normalized_tag text;
begin
  perform public.require_admin();

  if target_service_id is null then
    raise exception using errcode = '22023', message = 'service id is required';
  end if;

  update public.service_tags
  set tag = btrim(requested_tag)
  where service_id = target_service_id
    and normalized_tag = lower(regexp_replace(btrim(target_normalized_tag), '\s+', ' ', 'g'))
  returning tag, normalized_tag into previous_tag, updated_normalized_tag;

  if not found then
    raise exception using errcode = 'P0002', message = 'service tag not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_TAG_UPDATED',
    'SERVICE_TAG',
    target_service_id,
    jsonb_build_object(
      'previous_normalized_tag', lower(regexp_replace(btrim(target_normalized_tag), '\s+', ' ', 'g')),
      'tag', previous_tag,
      'normalized_tag', updated_normalized_tag
    )
  );

  return updated_normalized_tag;
end;
$$;

create or replace function public.admin_delete_service_tag(
  target_service_id uuid,
  target_normalized_tag text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  deleted_tag text;
begin
  perform public.require_admin();

  if target_service_id is null then
    raise exception using errcode = '22023', message = 'service id is required';
  end if;

  delete from public.service_tags
  where service_id = target_service_id
    and normalized_tag = lower(regexp_replace(btrim(target_normalized_tag), '\s+', ' ', 'g'))
  returning tag into deleted_tag;

  if not found then
    raise exception using errcode = 'P0002', message = 'service tag not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_TAG_DELETED',
    'SERVICE_TAG',
    target_service_id,
    jsonb_build_object(
      'tag', deleted_tag,
      'normalized_tag', lower(regexp_replace(btrim(target_normalized_tag), '\s+', ' ', 'g'))
    )
  );
end;
$$;

revoke all on function public.list_admin_skill_synonyms(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_admin_service_tags(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.admin_create_service_tag(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.admin_update_service_tag(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_service_tag(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.list_admin_skill_synonyms(uuid) to authenticated, service_role;
grant execute on function public.list_admin_service_tags(uuid) to authenticated, service_role;
grant execute on function public.admin_create_service_tag(uuid, text) to authenticated, service_role;
grant execute on function public.admin_update_service_tag(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_delete_service_tag(uuid, text) to authenticated, service_role;
