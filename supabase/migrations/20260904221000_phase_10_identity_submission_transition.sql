-- Phase 10: preserve server-authoritative provider status while allowing the
-- one user-owned lifecycle transition that submits identity evidence for review.
--
-- The application has always attempted PROFILE_INCOMPLETE -> IDENTITY_PENDING
-- immediately after a successful private identity upload. Phase 02 hardened all
-- status changes behind this trigger, which unintentionally blocked that valid
-- submission path as well. Keep every privileged transition server-only and
-- admit only this narrow, evidence-backed self-submission.

create or replace function public.guard_provider_status_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  request_user_id uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    if current_user in ('postgres', 'service_role') then
      return new;
    end if;

    if old.status = 'PROFILE_INCOMPLETE'
       and new.status = 'IDENTITY_PENDING'
       and request_user_id is not null
       and old.user_id = request_user_id
       and new.user_id = request_user_id
       and exists (
         select 1
         from public.provider_documents document
         join storage.objects object
           on object.bucket_id = 'identity-documents'
          and object.name = document.storage_path
         where document.user_id = request_user_id
       ) then
      return new;
    end if;

    raise exception 'provider status is server-authoritative'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
