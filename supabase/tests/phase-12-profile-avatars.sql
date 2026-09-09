begin;

select plan(8);

select ok(exists (select 1 from storage.buckets where id = 'profile-avatars'), 'profile avatar bucket exists');
select ok(not (select public from storage.buckets where id = 'profile-avatars'), 'profile avatar bucket is private');
select is((select file_size_limit::bigint from storage.buckets where id = 'profile-avatars'), 262144::bigint, 'profile avatar size is bounded');
select ok((select allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[] from storage.buckets where id = 'profile-avatars'), 'profile avatar MIME allowlist is image-only');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'profile_avatars_%'), 4, 'profile avatar storage has owner CRUD policies');
select ok(not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'profile_avatars_%' and 'anon' = any(roles)), 'anonymous avatar access is absent');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'profile_avatars_select_owner' and qual like '%auth.uid()%'), 'avatar reads are owner-scoped');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'profile_avatars_insert_owner' and with_check like '%auth.uid()%'), 'avatar writes are owner-scoped');
select * from finish();
rollback;
