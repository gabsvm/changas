create type public.provider_status as enum (
  'NOT_STARTED',
  'PROFILE_INCOMPLETE',
  'IDENTITY_PENDING',
  'UNDER_REVIEW',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
  'RESTRICTED',
  'DEACTIVATED'
);

create type public.identity_document_type as enum (
  'DNI_FRONT',
  'DNI_BACK',
  'SELFIE'
);

create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Usuario'
    check (char_length(display_name) between 2 and 80),
  avatar_url text
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  public_zone text
    check (public_zone is null or char_length(public_zone) <= 120),
  bio text
    check (bio is null or char_length(bio) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.profile_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  legal_name text check (legal_name is null or char_length(legal_name) <= 160),
  private_phone text check (private_phone is null or char_length(private_phone) <= 40),
  date_of_birth date,
  exact_address text check (exact_address is null or char_length(exact_address) <= 240),
  dni_number text check (dni_number is null or char_length(dni_number) <= 40),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.provider_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status public.provider_status not null default 'PROFILE_INCOMPLETE',
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 4),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.provider_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type public.identity_document_type not null,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  file_size_bytes integer not null check (file_size_bytes between 1 and 10485760),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_type)
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'es-AR' check (char_length(locale) between 2 and 20),
  timezone text check (timezone is null or char_length(timezone) <= 64),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profile_private_set_updated_at
before update on public.profile_private
for each row execute function public.set_updated_at();

create trigger provider_profiles_set_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create trigger user_roles_set_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    case
      when char_length(
        coalesce(
          nullif(new.raw_user_meta_data ->> 'display_name', ''),
          nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
          'Usuario'
        )
      ) between 2 and 80 then coalesce(
        nullif(new.raw_user_meta_data ->> 'display_name', ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      )
      else 'Usuario'
    end
  );

  insert into public.profile_private (user_id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.user_roles (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_documents enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_roles enable row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy profile_private_select_own
on public.profile_private for select to authenticated
using (user_id = (select auth.uid()));

create policy profile_private_insert_own
on public.profile_private for insert to authenticated
with check (user_id = (select auth.uid()));

create policy profile_private_update_own
on public.profile_private for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy provider_profiles_select_own
on public.provider_profiles for select to authenticated
using (user_id = (select auth.uid()));

create policy provider_profiles_insert_own
on public.provider_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status in ('PROFILE_INCOMPLETE', 'IDENTITY_PENDING')
);

create policy provider_profiles_update_own
on public.provider_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and status in ('PROFILE_INCOMPLETE', 'IDENTITY_PENDING')
);

create policy provider_documents_select_own
on public.provider_documents for select to authenticated
using (user_id = (select auth.uid()));

create policy provider_documents_insert_own
on public.provider_documents for insert to authenticated
with check (user_id = (select auth.uid()));

create policy provider_documents_update_own
on public.provider_documents for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy provider_documents_delete_own
on public.provider_documents for delete to authenticated
using (user_id = (select auth.uid()));

create policy user_settings_select_own
on public.user_settings for select to authenticated
using (user_id = (select auth.uid()));

create policy user_settings_insert_own
on public.user_settings for insert to authenticated
with check (user_id = (select auth.uid()));

create policy user_settings_update_own
on public.user_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy user_roles_select_own
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-documents',
  'identity-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy identity_documents_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy identity_documents_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy identity_documents_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy identity_documents_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
