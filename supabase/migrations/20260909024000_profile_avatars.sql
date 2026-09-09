-- Profile avatars are public product media, but storage remains private.
-- Anonymous reads are limited to the exact object currently referenced by a profile.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  262144,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_current_profile_avatar(object_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.avatar_url = '/api/avatar/' || object_path
  );
$$;

revoke all on function public.is_current_profile_avatar(text) from public, anon, authenticated;
grant execute on function public.is_current_profile_avatar(text) to anon, authenticated, service_role;

create policy profile_avatars_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy profile_avatars_select_current_public
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'profile-avatars'
  and public.is_current_profile_avatar(name)
);

create policy profile_avatars_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy profile_avatars_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy profile_avatars_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
