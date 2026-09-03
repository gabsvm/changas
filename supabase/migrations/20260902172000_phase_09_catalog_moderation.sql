-- Phase 09 Task 3: controlled catalog CRUD and reversible service moderation.

create table public.service_moderation_state (
  service_id uuid primary key references public.services(id) on delete cascade,
  state text not null default 'CLEAR'
    check (state in ('CLEAR', 'FLAGGED', 'DISABLED')),
  reason text,
  provider_paused_snapshot boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (state = 'CLEAR' and reason is null)
    or (
      state in ('FLAGGED', 'DISABLED')
      and reason is not null
      and char_length(btrim(reason)) between 3 and 1000
    )
  )
);

alter table public.service_moderation_state enable row level security;

revoke all privileges on table public.service_moderation_state
from public, anon, authenticated, service_role;
grant select, insert, update on table public.service_moderation_state to service_role;

create trigger service_moderation_state_set_updated_at
before update on public.service_moderation_state
for each row execute function public.set_updated_at();

create or replace function public.guard_disabled_service_unpause()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.is_paused
    and not new.is_paused
    and exists (
      select 1
      from public.service_moderation_state sms
      where sms.service_id = old.id
        and sms.state = 'DISABLED'
    )
    and not public.is_current_user_admin()
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service is disabled by moderation';
  end if;

  return new;
end;
$$;

create trigger services_moderation_pause_guard
before update of is_paused on public.services
for each row execute function public.guard_disabled_service_unpause();

revoke all on function public.guard_disabled_service_unpause()
from public, anon, authenticated, service_role;

create or replace function public.admin_create_category(
  requested_slug text,
  requested_name text,
  requested_description text default null,
  requested_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  created_id uuid;
begin
  perform public.require_admin();

  insert into public.categories (slug, name, description, sort_order)
  values (
    btrim(requested_slug),
    btrim(requested_name),
    nullif(btrim(coalesce(requested_description, '')), ''),
    requested_sort_order
  )
  returning id into created_id;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_CATEGORY_CREATED',
    'CATEGORY',
    created_id,
    jsonb_build_object('slug', btrim(requested_slug), 'name', btrim(requested_name))
  );

  return created_id;
end;
$$;

create or replace function public.admin_update_category(
  target_category_id uuid,
  requested_slug text,
  requested_name text,
  requested_description text,
  requested_sort_order integer,
  requested_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  perform public.require_admin();

  if target_category_id is null then
    raise exception using errcode = '22023', message = 'category id is required';
  end if;

  update public.categories
  set slug = btrim(requested_slug),
      name = btrim(requested_name),
      description = nullif(btrim(coalesce(requested_description, '')), ''),
      sort_order = requested_sort_order,
      is_active = requested_is_active,
      updated_at = timezone('utc', now())
  where id = target_category_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'category not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_CATEGORY_UPDATED',
    'CATEGORY',
    target_category_id,
    jsonb_build_object(
      'slug', btrim(requested_slug),
      'name', btrim(requested_name),
      'is_active', requested_is_active
    )
  );
end;
$$;

create or replace function public.admin_delete_category(target_category_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  deleted_slug text;
begin
  perform public.require_admin();

  delete from public.categories
  where id = target_category_id
  returning slug into deleted_slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'category not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_CATEGORY_DELETED',
    'CATEGORY',
    target_category_id,
    jsonb_build_object('slug', deleted_slug)
  );
end;
$$;

create or replace function public.admin_create_skill(
  target_category_id uuid,
  requested_slug text,
  requested_name text,
  requested_description text default null,
  requested_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  created_id uuid;
begin
  perform public.require_admin();

  insert into public.skills (category_id, slug, name, description, sort_order)
  values (
    target_category_id,
    btrim(requested_slug),
    btrim(requested_name),
    nullif(btrim(coalesce(requested_description, '')), ''),
    requested_sort_order
  )
  returning id into created_id;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_SKILL_CREATED',
    'SKILL',
    created_id,
    jsonb_build_object(
      'category_id', target_category_id,
      'slug', btrim(requested_slug),
      'name', btrim(requested_name)
    )
  );

  return created_id;
end;
$$;

create or replace function public.admin_update_skill(
  target_skill_id uuid,
  target_category_id uuid,
  requested_slug text,
  requested_name text,
  requested_description text,
  requested_sort_order integer,
  requested_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  perform public.require_admin();

  if target_skill_id is null then
    raise exception using errcode = '22023', message = 'skill id is required';
  end if;

  update public.skills
  set category_id = target_category_id,
      slug = btrim(requested_slug),
      name = btrim(requested_name),
      description = nullif(btrim(coalesce(requested_description, '')), ''),
      sort_order = requested_sort_order,
      is_active = requested_is_active,
      updated_at = timezone('utc', now())
  where id = target_skill_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'skill not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_SKILL_UPDATED',
    'SKILL',
    target_skill_id,
    jsonb_build_object(
      'category_id', target_category_id,
      'slug', btrim(requested_slug),
      'name', btrim(requested_name),
      'is_active', requested_is_active
    )
  );
end;
$$;

create or replace function public.admin_delete_skill(target_skill_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  deleted_slug text;
begin
  perform public.require_admin();

  delete from public.skills
  where id = target_skill_id
  returning slug into deleted_slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'skill not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_SKILL_DELETED',
    'SKILL',
    target_skill_id,
    jsonb_build_object('slug', deleted_slug)
  );
end;
$$;

create or replace function public.admin_create_skill_synonym(
  target_skill_id uuid,
  requested_phrase text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  created_id uuid;
  normalized_phrase text := public.normalize_search_text(requested_phrase);
begin
  perform public.require_admin();

  insert into public.skill_synonyms (skill_id, phrase, normalized_phrase)
  values (target_skill_id, btrim(requested_phrase), normalized_phrase)
  returning id into created_id;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_SYNONYM_CREATED',
    'SKILL_SYNONYM',
    created_id,
    jsonb_build_object('skill_id', target_skill_id, 'phrase', btrim(requested_phrase))
  );

  return created_id;
end;
$$;

create or replace function public.admin_update_skill_synonym(
  target_synonym_id uuid,
  requested_phrase text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  owning_skill_id uuid;
begin
  perform public.require_admin();

  update public.skill_synonyms
  set phrase = btrim(requested_phrase),
      normalized_phrase = public.normalize_search_text(requested_phrase)
  where id = target_synonym_id
  returning skill_id into owning_skill_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'skill synonym not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_SYNONYM_UPDATED',
    'SKILL_SYNONYM',
    target_synonym_id,
    jsonb_build_object('skill_id', owning_skill_id, 'phrase', btrim(requested_phrase))
  );
end;
$$;

create or replace function public.admin_delete_skill_synonym(target_synonym_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  owning_skill_id uuid;
  deleted_phrase text;
begin
  perform public.require_admin();

  delete from public.skill_synonyms
  where id = target_synonym_id
  returning skill_id, phrase into owning_skill_id, deleted_phrase;

  if not found then
    raise exception using errcode = 'P0002', message = 'skill synonym not found';
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'CATALOG_SYNONYM_DELETED',
    'SKILL_SYNONYM',
    target_synonym_id,
    jsonb_build_object('skill_id', owning_skill_id, 'phrase', deleted_phrase)
  );
end;
$$;

create or replace function public.admin_set_service_moderation(
  target_service_id uuid,
  requested_state text,
  requested_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_state text := upper(btrim(coalesce(requested_state, '')));
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  previous_state text := 'CLEAR';
  previous_snapshot boolean;
  current_provider_pause boolean;
begin
  perform public.require_admin();

  if target_service_id is null then
    raise exception using errcode = '22023', message = 'service id is required';
  end if;

  if normalized_state not in ('CLEAR', 'FLAGGED', 'DISABLED') then
    raise exception using errcode = '22023', message = 'invalid service moderation state';
  end if;

  if normalized_state in ('FLAGGED', 'DISABLED')
    and (normalized_reason is null or char_length(normalized_reason) not between 3 and 1000) then
    raise exception using errcode = '22023', message = 'moderation reason is required';
  end if;

  if normalized_state = 'CLEAR' then
    normalized_reason := null;
  end if;

  select s.is_paused
  into current_provider_pause
  from public.services s
  where s.id = target_service_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'service not found';
  end if;

  select sms.state, sms.provider_paused_snapshot
  into previous_state, previous_snapshot
  from public.service_moderation_state sms
  where sms.service_id = target_service_id
  for update;

  if not found then
    previous_state := 'CLEAR';
    previous_snapshot := current_provider_pause;
  end if;

  if normalized_state = 'DISABLED' then
    if previous_state <> 'DISABLED' then
      previous_snapshot := current_provider_pause;
    end if;

    update public.services
    set is_paused = true,
        updated_at = timezone('utc', now())
    where id = target_service_id;
  elsif previous_state = 'DISABLED' then
    update public.services
    set is_paused = previous_snapshot,
        updated_at = timezone('utc', now())
    where id = target_service_id;
  end if;

  insert into public.service_moderation_state (
    service_id,
    state,
    reason,
    provider_paused_snapshot,
    updated_by
  ) values (
    target_service_id,
    normalized_state,
    normalized_reason,
    previous_snapshot,
    actor_user_id
  )
  on conflict (service_id) do update set
    state = excluded.state,
    reason = excluded.reason,
    provider_paused_snapshot = excluded.provider_paused_snapshot,
    updated_by = excluded.updated_by,
    updated_at = timezone('utc', now());

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'SERVICE_MODERATION_SET',
    'SERVICE',
    target_service_id,
    jsonb_build_object(
      'previous_state', previous_state,
      'new_state', normalized_state,
      'reason', normalized_reason,
      'provider_paused_snapshot', previous_snapshot
    )
  );
end;
$$;

revoke all on function public.admin_create_category(text, text, text, integer)
from public, anon, authenticated, service_role;
revoke all on function public.admin_update_category(uuid, text, text, text, integer, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_category(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.admin_create_skill(uuid, text, text, text, integer)
from public, anon, authenticated, service_role;
revoke all on function public.admin_update_skill(uuid, uuid, text, text, text, integer, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_skill(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.admin_create_skill_synonym(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.admin_update_skill_synonym(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_skill_synonym(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.admin_set_service_moderation(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.admin_create_category(text, text, text, integer)
to authenticated, service_role;
grant execute on function public.admin_update_category(uuid, text, text, text, integer, boolean)
to authenticated, service_role;
grant execute on function public.admin_delete_category(uuid)
to authenticated, service_role;
grant execute on function public.admin_create_skill(uuid, text, text, text, integer)
to authenticated, service_role;
grant execute on function public.admin_update_skill(uuid, uuid, text, text, text, integer, boolean)
to authenticated, service_role;
grant execute on function public.admin_delete_skill(uuid)
to authenticated, service_role;
grant execute on function public.admin_create_skill_synonym(uuid, text)
to authenticated, service_role;
grant execute on function public.admin_update_skill_synonym(uuid, text)
to authenticated, service_role;
grant execute on function public.admin_delete_skill_synonym(uuid)
to authenticated, service_role;
grant execute on function public.admin_set_service_moderation(uuid, text, text)
to authenticated, service_role;