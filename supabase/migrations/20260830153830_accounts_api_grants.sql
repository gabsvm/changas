-- Phase 01 Data API exposure is explicit. RLS remains the row-level authority.
grant usage on schema public to authenticated, service_role;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.profile_private to authenticated;
grant select, insert, update on table public.provider_profiles to authenticated;
grant select, insert, update, delete on table public.provider_documents to authenticated;
grant select, insert, update on table public.user_settings to authenticated;
grant select on table public.user_roles to authenticated;

-- service_role is server-side/admin only and bypasses RLS by design. Keep this
-- grant explicit and limited to DML on the Phase 01 tables; it grants no DDL.
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.profile_private to service_role;
grant select, insert, update, delete on table public.provider_profiles to service_role;
grant select, insert, update, delete on table public.provider_documents to service_role;
grant select, insert, update, delete on table public.user_settings to service_role;
grant select, insert, update, delete on table public.user_roles to service_role;

-- Do not rely on inherited/default privileges for anonymous or PUBLIC access.
revoke all privileges on table public.profiles from anon, public;
revoke all privileges on table public.profile_private from anon, public;
revoke all privileges on table public.provider_profiles from anon, public;
revoke all privileges on table public.provider_documents from anon, public;
revoke all privileges on table public.user_settings from anon, public;
revoke all privileges on table public.user_roles from anon, public;
