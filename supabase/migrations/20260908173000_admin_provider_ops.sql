-- Admin provider operations and explicit provider identity review submission.
-- This migration keeps identity evidence private and restores provider status
-- transitions to server-authoritative RPCs only.

create or replace function public.submit_provider_identity_review()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  request_user_id uuid := auth.uid();
  current_status public.provider_status;
  required_document_count integer;
begin
  if request_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select pp.status
  into current_status
  from public.provider_profiles pp
  where pp.user_id = request_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'provider profile not found';
  end if;

  if current_status not in ('PROFILE_INCOMPLETE', 'IDENTITY_PENDING') then
    raise exception using errcode = '55000', message = 'provider cannot submit identity in current status';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = request_user_id
      and nullif(btrim(p.display_name), '') is not null
      and nullif(btrim(p.public_zone), '') is not null
      and nullif(btrim(p.bio), '') is not null
  ) then
    raise exception using errcode = '22023', message = 'public provider profile is incomplete';
  end if;

  if not exists (
    select 1
    from public.profile_private pr
    where pr.user_id = request_user_id
      and nullif(btrim(pr.legal_name), '') is not null
      and nullif(btrim(pr.private_phone), '') is not null
      and pr.date_of_birth is not null
      and nullif(btrim(pr.exact_address), '') is not null
      and nullif(btrim(pr.dni_number), '') is not null
  ) then
    raise exception using errcode = '22023', message = 'private identity profile is incomplete';
  end if;

  select count(distinct pd.document_type)
  into required_document_count
  from public.provider_documents pd
  join storage.objects so
    on so.bucket_id = 'identity-documents'
   and so.name = pd.storage_path
  where pd.user_id = request_user_id
    and pd.document_type in ('DNI_FRONT', 'DNI_BACK', 'SELFIE');

  if required_document_count <> 3 then
    raise exception using errcode = '22023', message = 'all required identity documents must be uploaded';
  end if;

  update public.provider_profiles
  set status = 'IDENTITY_PENDING',
      onboarding_step = 4,
      updated_at = timezone('utc', now())
  where user_id = request_user_id;
end;
$$;

revoke all on function public.submit_provider_identity_review()
from public, anon, authenticated, service_role;
grant execute on function public.submit_provider_identity_review()
to authenticated, service_role;

-- Phase 10 temporarily allowed a direct owner update from PROFILE_INCOMPLETE to
-- IDENTITY_PENDING after any single uploaded document. Submission now goes
-- through submit_provider_identity_review(), which validates the complete case.
create or replace function public.guard_provider_status_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and current_user not in ('postgres', 'service_role') then
    raise exception 'provider status is server-authoritative'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.admin_prepare_provider(
  target_user_id uuid
)
returns public.provider_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  result_status public.provider_status;
  inserted_provider boolean := false;
begin
  perform public.require_admin();

  if target_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;

  insert into public.provider_profiles (user_id, status, onboarding_step)
  values (target_user_id, 'PROFILE_INCOMPLETE', 1)
  on conflict (user_id) do nothing
  returning status into result_status;

  inserted_provider := found;

  if not inserted_provider then
    select pp.status
    into result_status
    from public.provider_profiles pp
    where pp.user_id = target_user_id;
  else
    insert into public.admin_audit_events (
      actor_user_id,
      action_type,
      target_type,
      target_id,
      metadata
    ) values (
      actor_user_id,
      'PROVIDER_ONBOARDING_PREPARED',
      'USER',
      target_user_id,
      jsonb_build_object('new_status', result_status)
    );
  end if;

  return result_status;
end;
$$;

create or replace function public.admin_activate_provider(
  target_user_id uuid,
  requested_reason text
)
returns public.provider_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_status public.provider_status;
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
begin
  perform public.require_admin();

  if target_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;

  if normalized_reason is null or char_length(normalized_reason) not between 3 and 1000 then
    raise exception using errcode = '22023', message = 'manual activation reason is required';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;

  select pp.status
  into previous_status
  from public.provider_profiles pp
  where pp.user_id = target_user_id
  for update;

  if found and previous_status in ('SUSPENDED', 'RESTRICTED', 'DEACTIVATED') then
    raise exception using errcode = '55000', message = 'restricted provider must be restored through account controls';
  end if;

  if previous_status = 'ACTIVE' then
    raise exception using errcode = '55000', message = 'provider is already active';
  end if;

  insert into public.provider_profiles (
    user_id,
    status,
    onboarding_step
  ) values (
    target_user_id,
    'ACTIVE',
    4
  )
  on conflict (user_id) do update
  set status = 'ACTIVE',
      onboarding_step = 4,
      updated_at = timezone('utc', now());

  insert into public.admin_audit_events (
    actor_user_id,
    action_type,
    target_type,
    target_id,
    metadata
  ) values (
    actor_user_id,
    'PROVIDER_MANUALLY_ACTIVATED',
    'PROVIDER',
    target_user_id,
    jsonb_build_object(
      'previous_status', previous_status,
      'new_status', 'ACTIVE',
      'reason', normalized_reason,
      'verification_bypassed', true
    )
  );

  return 'ACTIVE'::public.provider_status;
end;
$$;

revoke all on function public.admin_prepare_provider(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.admin_activate_provider(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.admin_prepare_provider(uuid)
to authenticated, service_role;
grant execute on function public.admin_activate_provider(uuid, text)
to authenticated, service_role;
