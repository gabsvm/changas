-- Phase 02: controlled provider marketplace catalog and professional offering.
-- Public discovery is intentionally limited to explicit views; this migration
-- does not implement search, ranking, booking, or any later phase.

create type public.service_modality as enum (
  'IN_PERSON',
  'REMOTE',
  'BOTH'
);

create type public.price_model as enum (
  'FIXED',
  'STARTING_AT',
  'HOURLY',
  'PER_UNIT',
  'QUOTE'
);

create type public.schedule_type as enum (
  'FIXED_SLOT',
  'FLEXIBLE_WINDOW',
  'DEADLINE',
  'UNSCHEDULED'
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique
    check (char_length(name) between 2 and 100),
  description text
    check (description is null or char_length(description) <= 500),
  sort_order smallint not null default 0
    check (sort_order between 0 and 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.skills (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null
    check (char_length(name) between 2 and 120),
  description text
    check (description is null or char_length(description) <= 500),
  sort_order smallint not null default 0
    check (sort_order between 0 and 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.skill_synonyms (
  id uuid primary key default extensions.gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  phrase text not null check (char_length(btrim(phrase)) between 2 and 120),
  normalized_phrase text not null
    check (normalized_phrase = lower(btrim(normalized_phrase))),
  created_at timestamptz not null default timezone('utc', now()),
  unique (skill_id, normalized_phrase)
);

alter table public.provider_profiles
  add column public_slug text,
  add column public_headline text
    check (public_headline is null or char_length(public_headline) <= 160),
  add column marketplace_paused boolean not null default false,
  add column availability_paused boolean not null default false;

update public.provider_profiles
set public_slug = 'provider-' || replace(user_id::text, '-', '')
where public_slug is null;

alter table public.provider_profiles
  alter column public_slug set not null,
  add constraint provider_profiles_public_slug_format
    check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create unique index provider_profiles_public_slug_idx
on public.provider_profiles (public_slug);

create table public.provider_skills (
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  sort_order smallint not null default 0
    check (sort_order between 0 and 999),
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (provider_user_id, skill_id)
);

create table public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  public_slug text not null
    check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 20 and 3000),
  modality public.service_modality not null,
  price_model public.price_model not null,
  price_amount bigint,
  currency_code text not null default 'ARS'
    check (currency_code ~ '^[A-Z]{3}$'),
  price_unit text
    check (price_unit is null or char_length(btrim(price_unit)) between 2 and 60),
  accepts_offers boolean not null default false,
  expected_duration_minutes integer
    check (expected_duration_minutes is null or expected_duration_minutes between 1 and 10080),
  schedule_type public.schedule_type not null default 'UNSCHEDULED',
  includes text check (includes is null or char_length(includes) <= 1500),
  excludes text check (excludes is null or char_length(excludes) <= 1500),
  materials_notes text
    check (materials_notes is null or char_length(materials_notes) <= 1500),
  is_published boolean not null default false,
  is_paused boolean not null default false,
  sort_order smallint not null default 0
    check (sort_order between 0 and 999),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider_user_id, public_slug),
  check (
    (price_model = 'QUOTE' and price_amount is null and price_unit is null)
    or (
      price_model = 'PER_UNIT'
      and price_amount is not null and price_amount > 0
      and price_unit is not null and char_length(btrim(price_unit)) >= 2
    )
    or (
      price_model <> 'QUOTE' and price_model <> 'PER_UNIT'
      and price_amount is not null and price_amount > 0
      and price_unit is null
    )
  )
);

create table public.service_tags (
  service_id uuid not null references public.services(id) on delete cascade,
  tag text not null check (char_length(btrim(tag)) between 2 and 80),
  normalized_tag text generated always as (lower(regexp_replace(btrim(tag), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (service_id, normalized_tag)
);

create table public.experiences (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  organization text check (organization is null or char_length(organization) <= 160),
  description text check (description is null or char_length(description) <= 2000),
  started_on date not null,
  ended_on date,
  is_current boolean not null default false,
  is_public boolean not null default false,
  sort_order smallint not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ended_on is null or ended_on >= started_on),
  check (not is_current or ended_on is null)
);

create table public.education (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  institution text not null check (char_length(btrim(institution)) between 2 and 160),
  field_of_study text check (field_of_study is null or char_length(field_of_study) <= 160),
  description text check (description is null or char_length(description) <= 2000),
  started_on date not null,
  ended_on date,
  is_public boolean not null default false,
  sort_order smallint not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ended_on is null or ended_on >= started_on)
);

create table public.certifications (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  issuer text check (issuer is null or char_length(issuer) <= 160),
  description text check (description is null or char_length(description) <= 1500),
  issued_on date,
  expires_on date,
  evidence_path text,
  evidence_mime_type text
    check (evidence_mime_type is null or evidence_mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  evidence_file_size_bytes integer
    check (evidence_file_size_bytes is null or evidence_file_size_bytes between 1 and 10485760),
  is_public boolean not null default false,
  sort_order smallint not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_on is null or issued_on is null or expires_on >= issued_on),
  check (
    (evidence_path is null and evidence_mime_type is null and evidence_file_size_bytes is null)
    or (evidence_path is not null and evidence_mime_type is not null and evidence_file_size_bytes is not null)
  )
);

create table public.portfolio_items (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text check (description is null or char_length(description) <= 1500),
  media_path text,
  media_mime_type text
    check (media_mime_type is null or media_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  media_file_size_bytes integer
    check (media_file_size_bytes is null or media_file_size_bytes between 1 and 5242880),
  is_public boolean not null default false,
  sort_order smallint not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (media_path is null and media_mime_type is null and media_file_size_bytes is null)
    or (media_path is not null and media_mime_type is not null and media_file_size_bytes is not null and is_public)
  )
);

create table public.service_areas (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 2 and 160),
  center extensions.geography(POINT, 4326) not null,
  radius_meters integer not null check (radius_meters between 100 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.availability_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null check (char_length(btrim(timezone)) between 1 and 64),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_time > start_time)
);

create table public.availability_blocks (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 240),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at)
);

create index skills_category_active_idx
on public.skills (category_id, is_active, sort_order);
create index skill_synonyms_skill_idx on public.skill_synonyms (skill_id);
create index provider_skills_skill_idx on public.provider_skills (skill_id, provider_user_id);
create index services_provider_public_idx
on public.services (provider_user_id, is_published, is_paused, sort_order);
create index services_skill_public_idx
on public.services (skill_id, is_published, is_paused);
create index experiences_provider_public_idx
on public.experiences (provider_user_id, is_public, sort_order);
create index education_provider_public_idx
on public.education (provider_user_id, is_public, sort_order);
create index certifications_provider_public_idx
on public.certifications (provider_user_id, is_public, sort_order);
create index portfolio_provider_public_idx
on public.portfolio_items (provider_user_id, is_public, sort_order);
create index service_areas_provider_active_idx
on public.service_areas (provider_user_id, is_active);
create index service_areas_center_gist_idx
on public.service_areas using gist (center);
create index availability_rules_provider_idx
on public.availability_rules (provider_user_id, weekday, start_time);
create index availability_blocks_provider_idx
on public.availability_blocks (provider_user_id, starts_at, ends_at);

create or replace function public.set_marketplace_provider_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.public_slug is null or btrim(new.public_slug) = '' then
    new.public_slug := 'provider-' || replace(new.user_id::text, '-', '');
  end if;
  return new;
end;
$$;

create trigger provider_profiles_set_marketplace_slug
before insert on public.provider_profiles
for each row execute function public.set_marketplace_provider_slug();

create or replace function public.set_marketplace_service_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.public_slug is null or btrim(new.public_slug) = '' then
    new.public_slug := 'service-' || replace(new.id::text, '-', '');
  end if;
  return new;
end;
$$;

create trigger services_set_marketplace_slug
before insert on public.services
for each row execute function public.set_marketplace_service_slug();

create or replace function public.guard_provider_status_change()
returns trigger
language plpgsql
set search_path = public
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

create trigger provider_profiles_status_guard
before update on public.provider_profiles
for each row execute function public.guard_provider_status_change();

create or replace function public.guard_service_publication()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_published and (
    not exists (
      select 1
      from public.provider_profiles as provider
      where provider.user_id = new.provider_user_id
        and provider.status = 'ACTIVE'
        and not provider.marketplace_paused
    )
  ) then
    raise exception 'only an active, unpaused provider can publish services'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger services_publication_guard
before insert or update on public.services
for each row execute function public.guard_service_publication();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();
create trigger skills_set_updated_at
before update on public.skills
for each row execute function public.set_updated_at();
create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();
create trigger experiences_set_updated_at
before update on public.experiences
for each row execute function public.set_updated_at();
create trigger education_set_updated_at
before update on public.education
for each row execute function public.set_updated_at();
create trigger certifications_set_updated_at
before update on public.certifications
for each row execute function public.set_updated_at();
create trigger portfolio_items_set_updated_at
before update on public.portfolio_items
for each row execute function public.set_updated_at();
create trigger service_areas_set_updated_at
before update on public.service_areas
for each row execute function public.set_updated_at();
create trigger availability_rules_set_updated_at
before update on public.availability_rules
for each row execute function public.set_updated_at();
create trigger availability_blocks_set_updated_at
before update on public.availability_blocks
for each row execute function public.set_updated_at();

-- Catalog data is public read-only data. Provider-owned tables remain
-- inaccessible to anon and are exposed only through owner RLS policies.
alter table public.categories enable row level security;
alter table public.skills enable row level security;
alter table public.skill_synonyms enable row level security;
alter table public.provider_skills enable row level security;
alter table public.services enable row level security;
alter table public.service_tags enable row level security;
alter table public.experiences enable row level security;
alter table public.education enable row level security;
alter table public.certifications enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.service_areas enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_blocks enable row level security;

create policy categories_select_public
on public.categories for select to anon, authenticated
using (is_active);

create policy skills_select_public
on public.skills for select to anon, authenticated
using (is_active);

create policy skill_synonyms_select_public
on public.skill_synonyms for select to anon, authenticated
using (exists (
  select 1 from public.skills
  where skills.id = skill_synonyms.skill_id and skills.is_active
));

create policy provider_skills_select_own
on public.provider_skills for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy provider_skills_insert_own
on public.provider_skills for insert to authenticated
with check (
  provider_user_id = (select auth.uid())
  and exists (select 1 from public.skills where skills.id = provider_skills.skill_id and skills.is_active)
);
create policy provider_skills_update_own
on public.provider_skills for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (
  provider_user_id = (select auth.uid())
  and exists (select 1 from public.skills where skills.id = provider_skills.skill_id and skills.is_active)
);
create policy provider_skills_delete_own
on public.provider_skills for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy services_select_own
on public.services for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy services_insert_own
on public.services for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy services_update_own
on public.services for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy services_delete_own
on public.services for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy service_tags_select_own
on public.service_tags for select to authenticated
using (exists (
  select 1 from public.services
  where services.id = service_tags.service_id
    and services.provider_user_id = (select auth.uid())
));
create policy service_tags_insert_own
on public.service_tags for insert to authenticated
with check (exists (
  select 1 from public.services
  where services.id = service_tags.service_id
    and services.provider_user_id = (select auth.uid())
));
create policy service_tags_update_own
on public.service_tags for update to authenticated
using (exists (
  select 1 from public.services
  where services.id = service_tags.service_id
    and services.provider_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.services
  where services.id = service_tags.service_id
    and services.provider_user_id = (select auth.uid())
));
create policy service_tags_delete_own
on public.service_tags for delete to authenticated
using (exists (
  select 1 from public.services
  where services.id = service_tags.service_id
    and services.provider_user_id = (select auth.uid())
));

create policy experiences_select_own
on public.experiences for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy experiences_insert_own
on public.experiences for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy experiences_update_own
on public.experiences for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy experiences_delete_own
on public.experiences for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy education_select_own
on public.education for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy education_insert_own
on public.education for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy education_update_own
on public.education for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy education_delete_own
on public.education for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy certifications_select_own
on public.certifications for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy certifications_insert_own
on public.certifications for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy certifications_update_own
on public.certifications for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy certifications_delete_own
on public.certifications for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy portfolio_items_select_own
on public.portfolio_items for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy portfolio_items_insert_own
on public.portfolio_items for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy portfolio_items_update_own
on public.portfolio_items for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy portfolio_items_delete_own
on public.portfolio_items for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy service_areas_select_own
on public.service_areas for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy service_areas_insert_own
on public.service_areas for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy service_areas_update_own
on public.service_areas for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy service_areas_delete_own
on public.service_areas for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy availability_rules_select_own
on public.availability_rules for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy availability_rules_insert_own
on public.availability_rules for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy availability_rules_update_own
on public.availability_rules for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy availability_rules_delete_own
on public.availability_rules for delete to authenticated
using (provider_user_id = (select auth.uid()));

create policy availability_blocks_select_own
on public.availability_blocks for select to authenticated
using (provider_user_id = (select auth.uid()));
create policy availability_blocks_insert_own
on public.availability_blocks for insert to authenticated
with check (provider_user_id = (select auth.uid()));
create policy availability_blocks_update_own
on public.availability_blocks for update to authenticated
using (provider_user_id = (select auth.uid()))
with check (provider_user_id = (select auth.uid()));
create policy availability_blocks_delete_own
on public.availability_blocks for delete to authenticated
using (provider_user_id = (select auth.uid()));

-- Keep the original Phase 01 policy semantics intact. An additional policy
-- lets an already ACTIVE provider edit only marketplace pause fields while the
-- trigger above remains the authority that rejects any status transition.
drop policy provider_profiles_update_own on public.provider_profiles;
create policy provider_profiles_update_own
on public.provider_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and status in ('PROFILE_INCOMPLETE', 'IDENTITY_PENDING')
);
create policy provider_profiles_update_active_marketplace
on public.provider_profiles for update to authenticated
using (
  user_id = (select auth.uid())
  and status = 'ACTIVE'
)
with check (
  user_id = (select auth.uid())
  and status = 'ACTIVE'
);

-- Explicit, narrow grants. No client role receives direct access to an
-- owner-owned table through the Data API.
grant usage on schema public to anon, authenticated, service_role;

revoke all privileges on table public.categories, public.skills, public.skill_synonyms from anon, authenticated, public;
grant select on table public.categories, public.skills, public.skill_synonyms to anon, authenticated;
grant select, insert, update, delete on table public.categories, public.skills, public.skill_synonyms to service_role;

revoke all privileges on table public.provider_skills, public.services, public.service_tags,
  public.experiences, public.education, public.certifications, public.portfolio_items,
  public.service_areas, public.availability_rules, public.availability_blocks
from anon, authenticated, public;
grant select, insert, update, delete on table public.provider_skills, public.services, public.service_tags,
  public.experiences, public.education, public.certifications, public.portfolio_items,
  public.service_areas, public.availability_rules, public.availability_blocks
to authenticated;
grant select, insert, update, delete on table public.provider_skills, public.services, public.service_tags,
  public.experiences, public.education, public.certifications, public.portfolio_items,
  public.service_areas, public.availability_rules, public.availability_blocks
to service_role;

-- The fixture-only activation path is intentionally isolated from the public
-- API. It is useful for deterministic local/CI fixtures without creating a
-- client-callable way to bypass the Phase 01 onboarding authority.
create schema if not exists private;

create or replace function private.activate_provider_for_test(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'fixture activation is restricted to server-side roles'
      using errcode = '42501';
  end if;

  update public.provider_profiles
  set status = 'ACTIVE', updated_at = timezone('utc', now())
  where user_id = target_user_id;

  if not found then
    raise exception 'provider fixture does not exist'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
revoke all on function private.activate_provider_for_test(uuid) from public, anon, authenticated;
grant execute on function private.activate_provider_for_test(uuid) to service_role;

-- Public projections are deliberately denormalized read models. They expose
-- only fields approved for public provider/service pages and do not grant
-- direct access to provider-owned source tables.
create view public.public_provider_profiles as
select
  pp.public_slug,
  p.display_name,
  p.avatar_url,
  p.public_zone,
  p.bio,
  pp.public_headline,
  'verified_provider'::text as verification_badge
from public.provider_profiles pp
join public.profiles p on p.id = pp.user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused;

create view public.public_provider_skills as
select
  pp.public_slug as provider_slug,
  s.slug as skill_slug,
  s.name as skill_name,
  c.slug as category_slug,
  c.name as category_name,
  ps.is_featured,
  ps.sort_order
from public.provider_skills ps
join public.provider_profiles pp on pp.user_id = ps.provider_user_id
join public.skills s on s.id = ps.skill_id and s.is_active
join public.categories c on c.id = s.category_id and c.is_active
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused;

create view public.public_provider_services as
select
  pp.public_slug as provider_slug,
  s.public_slug,
  s.title,
  s.description,
  s.modality,
  s.price_model,
  s.price_amount,
  s.currency_code,
  s.price_unit,
  s.accepts_offers,
  s.expected_duration_minutes,
  s.schedule_type,
  s.includes,
  s.excludes,
  s.materials_notes,
  sk.slug as skill_slug,
  sk.name as skill_name,
  s.sort_order
from public.services s
join public.provider_profiles pp on pp.user_id = s.provider_user_id
join public.skills sk on sk.id = s.skill_id and sk.is_active
join public.categories c on c.id = sk.category_id and c.is_active
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and s.is_published
  and not s.is_paused;

create view public.public_service_tags as
select
  s.public_slug as service_public_slug,
  st.tag
from public.service_tags st
join public.services s on s.id = st.service_id
join public.provider_profiles pp on pp.user_id = s.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and s.is_published
  and not s.is_paused;

create view public.public_provider_experiences as
select
  pp.public_slug as provider_slug,
  e.title,
  e.organization,
  e.description,
  e.started_on,
  e.ended_on,
  e.is_current,
  e.sort_order
from public.experiences e
join public.provider_profiles pp on pp.user_id = e.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and e.is_public;

create view public.public_provider_education as
select
  pp.public_slug as provider_slug,
  e.institution,
  e.field_of_study,
  e.description,
  e.started_on,
  e.ended_on,
  e.sort_order
from public.education e
join public.provider_profiles pp on pp.user_id = e.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and e.is_public;

create view public.public_provider_certifications as
select
  pp.public_slug as provider_slug,
  c.title,
  c.issuer,
  c.description,
  c.issued_on,
  c.expires_on,
  c.sort_order
from public.certifications c
join public.provider_profiles pp on pp.user_id = c.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and c.is_public;

create view public.public_provider_portfolio as
select
  p.id,
  pp.public_slug as provider_slug,
  p.title,
  p.description,
  p.media_path,
  p.media_mime_type,
  p.sort_order
from public.portfolio_items p
join public.provider_profiles pp on pp.user_id = p.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and p.is_public;

create view public.public_provider_service_areas as
select
  pp.public_slug as provider_slug,
  a.label,
  a.radius_meters
from public.service_areas a
join public.provider_profiles pp on pp.user_id = a.provider_user_id
where pp.status = 'ACTIVE'
  and not pp.marketplace_paused
  and a.is_active;

revoke all on table public.public_provider_profiles, public.public_provider_skills,
  public.public_provider_services, public.public_service_tags,
  public.public_provider_experiences, public.public_provider_education,
  public.public_provider_certifications, public.public_provider_portfolio,
  public.public_provider_service_areas from public, anon, authenticated, service_role;
grant select on table public.public_provider_profiles, public.public_provider_skills,
  public.public_provider_services, public.public_service_tags,
  public.public_provider_experiences, public.public_provider_education,
  public.public_provider_certifications, public.public_provider_portfolio,
  public.public_provider_service_areas to anon, authenticated, service_role;

-- Synthetic catalog data is intentionally small and stable. It supports the
-- Phase 02 management flow without pretending to be marketplace inventory.
insert into public.categories (id, slug, name, description, sort_order)
values
  ('21000000-0000-4000-8000-000000000001', 'hogar', 'Hogar', 'Ayuda práctica para la casa.', 10),
  ('21000000-0000-4000-8000-000000000002', 'tecnologia', 'Tecnología', 'Soporte y soluciones digitales.', 20),
  ('21000000-0000-4000-8000-000000000003', 'educacion', 'Educación', 'Clases y acompañamiento de aprendizaje.', 30),
  ('21000000-0000-4000-8000-000000000004', 'mascotas', 'Mascotas', 'Cuidado y acompañamiento de mascotas.', 40),
  ('21000000-0000-4000-8000-000000000005', 'servicios-profesionales', 'Servicios profesionales', 'Servicios especializados para personas y equipos.', 50),
  ('21000000-0000-4000-8000-000000000006', 'belleza-bienestar', 'Belleza y bienestar', 'Servicios de cuidado personal y bienestar.', 60),
  ('21000000-0000-4000-8000-000000000007', 'otros', 'Otros', 'Servicios que no encajan en otra categoría.', 70)
on conflict (slug) do nothing;

insert into public.skills (id, category_id, slug, name, description, sort_order)
values
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'limpieza', 'Limpieza', 'Limpieza general de hogares.', 10),
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'armado-de-muebles', 'Armado de muebles', 'Armado de muebles y pequeños ajustes.', 20),
  ('22000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000002', 'reparacion-pc', 'Reparación de PC', 'Diagnóstico y reparación de equipos.', 10),
  ('22000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000002', 'soporte-tecnico-remoto', 'Soporte técnico remoto', 'Asistencia técnica a distancia.', 20),
  ('22000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000002', 'instalacion-camaras', 'Instalación de cámaras', 'Instalación doméstica de cámaras.', 30),
  ('22000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000003', 'ingles-conversacional', 'Inglés conversacional', 'Práctica de conversación en inglés.', 10),
  ('22000000-0000-4000-8000-000000000007', '21000000-0000-4000-8000-000000000003', 'apoyo-matematico', 'Apoyo de matemática', 'Acompañamiento para matemática.', 20),
  ('22000000-0000-4000-8000-000000000008', '21000000-0000-4000-8000-000000000004', 'paseo-de-perros', 'Paseo de perros', 'Paseos individuales o en grupos pequeños.', 10),
  ('22000000-0000-4000-8000-000000000009', '21000000-0000-4000-8000-000000000004', 'cuidado-de-mascotas', 'Cuidado de mascotas', 'Cuidado durante ausencias breves.', 20),
  ('22000000-0000-4000-8000-000000000010', '21000000-0000-4000-8000-000000000005', 'diseno-grafico', 'Diseño gráfico', 'Piezas visuales para proyectos y negocios.', 10),
  ('22000000-0000-4000-8000-000000000011', '21000000-0000-4000-8000-000000000005', 'traduccion', 'Traducción', 'Traducción de textos breves.', 20),
  ('22000000-0000-4000-8000-000000000012', '21000000-0000-4000-8000-000000000006', 'peluqueria', 'Peluquería', 'Corte y cuidado del cabello.', 10),
  ('22000000-0000-4000-8000-000000000013', '21000000-0000-4000-8000-000000000006', 'masaje-bienestar', 'Masaje y bienestar', 'Sesiones de bienestar no clínico.', 20),
  ('22000000-0000-4000-8000-000000000014', '21000000-0000-4000-8000-000000000007', 'mandados', 'Mandados', 'Ayuda con mandados locales.', 10)
on conflict (slug) do nothing;

insert into public.skill_synonyms (skill_id, phrase, normalized_phrase)
values
  ('22000000-0000-4000-8000-000000000003', 'arreglo de computadora', 'arreglo de computadora'),
  ('22000000-0000-4000-8000-000000000003', 'reparación pc', 'reparación pc'),
  ('22000000-0000-4000-8000-000000000004', 'ayuda informática', 'ayuda informática'),
  ('22000000-0000-4000-8000-000000000006', 'clases de inglés', 'clases de inglés'),
  ('22000000-0000-4000-8000-000000000008', 'paseador de perros', 'paseador de perros'),
  ('22000000-0000-4000-8000-000000000010', 'diseño', 'diseño'),
  ('22000000-0000-4000-8000-000000000012', 'corte de pelo', 'corte de pelo')
on conflict (skill_id, normalized_phrase) do nothing;

-- Separate buckets keep identity documents out of the marketplace media path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('provider-certification-evidence', 'provider-certification-evidence', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']::text[]),
  ('provider-portfolio', 'provider-portfolio', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_public_portfolio_media(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portfolio_items p
    join public.provider_profiles pp on pp.user_id = p.provider_user_id
    where p.media_path = object_path
      and p.is_public
      and pp.status = 'ACTIVE'
      and not pp.marketplace_paused
  );
$$;

revoke all on function public.is_public_portfolio_media(text) from public, anon, authenticated;
grant execute on function public.is_public_portfolio_media(text) to anon, authenticated, service_role;

create policy provider_certification_evidence_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'provider-certification-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy provider_certification_evidence_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'provider-certification-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy provider_certification_evidence_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'provider-certification-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'provider-certification-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy provider_certification_evidence_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'provider-certification-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy provider_portfolio_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'provider-portfolio'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_public_portfolio_media(name)
  )
);
create policy provider_portfolio_select_public
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'provider-portfolio'
  and public.is_public_portfolio_media(name)
);
create policy provider_portfolio_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'provider-portfolio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy provider_portfolio_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'provider-portfolio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'provider-portfolio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy provider_portfolio_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'provider-portfolio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
