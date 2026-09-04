-- Phase 09 closure fix: remove PL/pgSQL ambiguity between RPC parameters
-- and account_restrictions.target_user_id while preserving the published API.

create or replace function public.admin_set_account_restriction(
  target_user_id uuid,
  requested_kind text,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  restricted_user_id uuid := target_user_id;
  normalized_kind text := upper(btrim(coalesce(requested_kind, '')));
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  current_status public.provider_status;
  current_marketplace_paused boolean;
  current_availability_paused boolean;
  safe_previous_status public.provider_status;
  safe_marketplace_paused boolean;
  safe_availability_paused boolean;
  existing public.account_restrictions%rowtype;
  created_restriction_id uuid;
begin
  perform public.require_admin();

  if restricted_user_id is null
    or not exists (select 1 from auth.users au where au.id = restricted_user_id) then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;
  if restricted_user_id = actor_user_id then
    raise exception using errcode = '42501', message = 'admin cannot restrict their own account';
  end if;
  if normalized_kind not in ('RESTRICTED', 'SUSPENDED') then
    raise exception using errcode = '22023', message = 'invalid restriction kind';
  end if;
  if normalized_reason is null or char_length(normalized_reason) not between 3 and 1000 then
    raise exception using errcode = '22023', message = 'restriction reason is required';
  end if;

  select * into existing
  from public.account_restrictions ar
  where ar.target_user_id = restricted_user_id
    and ar.revoked_at is null
  for update;

  select pp.status, pp.marketplace_paused, pp.availability_paused
    into current_status, current_marketplace_paused, current_availability_paused
  from public.provider_profiles pp
  where pp.user_id = restricted_user_id
  for update;

  if existing.id is not null then
    safe_previous_status := existing.previous_provider_status;
    safe_marketplace_paused := existing.previous_marketplace_paused;
    safe_availability_paused := existing.previous_availability_paused;

    update public.account_restrictions
    set revoked_by = actor_user_id,
        revoked_reason = 'Reemplazada por una nueva restricción administrativa.',
        revoked_at = timezone('utc', now())
    where id = existing.id;
  else
    safe_previous_status := current_status;
    safe_marketplace_paused := current_marketplace_paused;
    safe_availability_paused := current_availability_paused;
  end if;

  insert into public.account_restrictions (
    target_user_id, kind, reason, previous_provider_status,
    previous_marketplace_paused, previous_availability_paused, created_by
  ) values (
    restricted_user_id, normalized_kind, normalized_reason, safe_previous_status,
    safe_marketplace_paused, safe_availability_paused, actor_user_id
  ) returning id into created_restriction_id;

  if current_status is not null then
    update public.provider_profiles
    set status = normalized_kind::public.provider_status,
        marketplace_paused = true,
        availability_paused = true,
        updated_at = timezone('utc', now())
    where user_id = restricted_user_id;
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    case when normalized_kind = 'SUSPENDED' then 'ACCOUNT_SUSPENDED' else 'ACCOUNT_RESTRICTED' end,
    'USER',
    restricted_user_id,
    jsonb_build_object('restriction_id', created_restriction_id, 'kind', normalized_kind)
  );

  return created_restriction_id;
end;
$$;

create or replace function public.admin_restore_account(
  target_user_id uuid,
  requested_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  restored_user_id uuid := target_user_id;
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  active_restriction public.account_restrictions%rowtype;
  restored_status public.provider_status;
begin
  perform public.require_admin();

  if restored_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception using errcode = '22023', message = 'restore reason is too long';
  end if;

  select * into active_restriction
  from public.account_restrictions ar
  where ar.target_user_id = restored_user_id
    and ar.revoked_at is null
  for update;

  if active_restriction.id is null then
    raise exception using errcode = 'P0002', message = 'active account restriction not found';
  end if;

  update public.account_restrictions
  set revoked_by = actor_user_id,
      revoked_reason = coalesce(normalized_reason, 'Restaurada por administración.'),
      revoked_at = timezone('utc', now())
  where id = active_restriction.id;

  if exists (
    select 1
    from public.provider_profiles pp
    where pp.user_id = restored_user_id
  ) then
    restored_status := case
      when active_restriction.previous_provider_status in (
        'NOT_STARTED', 'PROFILE_INCOMPLETE', 'IDENTITY_PENDING', 'UNDER_REVIEW',
        'ACTIVE', 'REJECTED'
      ) then active_restriction.previous_provider_status
      else 'PROFILE_INCOMPLETE'::public.provider_status
    end;

    update public.provider_profiles
    set status = restored_status,
        marketplace_paused = coalesce(active_restriction.previous_marketplace_paused, false),
        availability_paused = coalesce(active_restriction.previous_availability_paused, false),
        updated_at = timezone('utc', now())
    where user_id = restored_user_id;
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'ACCOUNT_RESTORED',
    'USER',
    restored_user_id,
    jsonb_build_object(
      'restriction_id', active_restriction.id,
      'previous_kind', active_restriction.kind,
      'restored_provider_status', restored_status
    )
  );

  return active_restriction.id;
end;
$$;
