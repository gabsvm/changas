-- Audit fix: a REJECTED provider had no way back. Submission only accepted
-- PROFILE_INCOMPLETE/IDENTITY_PENDING, the app blocked every edit, the RLS
-- update policy rejected any write to a REJECTED row, and the rejection
-- reason was service_role-only. Now a rejected provider can fix their case,
-- see the reason, and resubmit. Status flips stay server-side: the guard
-- trigger still rejects any client-driven status change.

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

  if current_status not in ('PROFILE_INCOMPLETE', 'IDENTITY_PENDING', 'REJECTED') then
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

-- Rejected providers update onboarding_step while fixing their case. The
-- guard trigger still rejects every client-driven status change, so this
-- only opens non-status writes on REJECTED rows.
drop policy provider_profiles_update_own on public.provider_profiles;
create policy provider_profiles_update_own
on public.provider_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and status in ('PROFILE_INCOMPLETE', 'IDENTITY_PENDING', 'REJECTED')
);

-- Providers read their own latest decision (reason included) without
-- exposing reviewer identities or the full immutable history table.
create or replace function public.get_my_latest_identity_review()
returns table (
  decision text,
  reason text,
  previous_status public.provider_status,
  new_status public.provider_status,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    pir.decision,
    pir.reason,
    pir.previous_status,
    pir.new_status,
    pir.created_at
  from public.provider_identity_reviews pir
  where pir.provider_user_id = caller_id
  order by pir.created_at desc, pir.id desc
  limit 1;
end;
$$;

revoke all on function public.get_my_latest_identity_review()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_latest_identity_review()
to authenticated, service_role;
