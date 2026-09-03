-- Phase 09 Task 1: server-enforced admin RBAC, bounded read models and append-only audit authority.

create table public.admin_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action_type text not null check (char_length(btrim(action_type)) between 2 and 80),
  target_type text not null check (char_length(btrim(target_type)) between 2 and 80),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index admin_audit_events_created_idx
on public.admin_audit_events (created_at desc, id desc);

alter table public.admin_audit_events enable row level security;

revoke all privileges on table public.admin_audit_events from public, anon, authenticated, service_role;
grant select, insert on table public.admin_audit_events to service_role;

create or replace function public.reject_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '42501', message = 'admin audit events are append-only';
end;
$$;

create trigger admin_audit_events_immutable_guard
before update or delete on public.admin_audit_events
for each row execute function public.reject_admin_audit_mutation();

revoke all on function public.reject_admin_audit_mutation()
from public, anon, authenticated, service_role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_current_user_admin()
from public, anon, authenticated, service_role;
grant execute on function public.is_current_user_admin()
to authenticated, service_role;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
end;
$$;

revoke all on function public.require_admin()
from public, anon, authenticated, service_role;

create or replace function public.append_admin_audit_event(
  requested_action_type text,
  requested_target_type text,
  requested_target_id uuid default null,
  requested_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_event_id uuid;
begin
  perform public.require_admin();

  if requested_action_type is null
    or char_length(btrim(requested_action_type)) not between 2 and 80
    or requested_target_type is null
    or char_length(btrim(requested_target_type)) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'invalid admin audit event';
  end if;

  insert into public.admin_audit_events (
    actor_user_id,
    action_type,
    target_type,
    target_id,
    metadata
  ) values (
    auth.uid(),
    btrim(requested_action_type),
    btrim(requested_target_type),
    requested_target_id,
    coalesce(requested_metadata, '{}'::jsonb)
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

revoke all on function public.append_admin_audit_event(text, text, uuid, jsonb)
from public, anon, authenticated, service_role;

create or replace function public.list_admin_users(
  search_text text default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  provider_status public.provider_status,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if page_size is null or page_size < 1 or page_size > 100
    or page_offset is null or page_offset < 0 or page_offset > 10000 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.display_name,
    coalesce(ur.role, 'user'::public.app_role),
    pp.status,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles ur on ur.user_id = u.id
  left join public.provider_profiles pp on pp.user_id = u.id
  where nullif(btrim(search_text), '') is null
    or coalesce(u.email, '') ilike '%' || btrim(search_text) || '%'
    or coalesce(p.display_name, '') ilike '%' || btrim(search_text) || '%'
  order by u.created_at desc, u.id desc
  limit page_size
  offset page_offset;
end;
$$;

create or replace function public.get_admin_user_detail(target_user_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  provider_status public.provider_status,
  legal_name text,
  private_phone text,
  date_of_birth date,
  dni_number text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if target_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.display_name,
    coalesce(ur.role, 'user'::public.app_role),
    pp.status,
    pr.legal_name,
    pr.private_phone,
    pr.date_of_birth,
    pr.dni_number,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles ur on ur.user_id = u.id
  left join public.provider_profiles pp on pp.user_id = u.id
  left join public.profile_private pr on pr.user_id = u.id
  where u.id = target_user_id;
end;
$$;

create or replace function public.list_admin_providers(
  search_text text default null,
  requested_status public.provider_status default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  provider_user_id uuid,
  email text,
  display_name text,
  public_slug text,
  public_headline text,
  status public.provider_status,
  onboarding_step smallint,
  document_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if page_size is null or page_size < 1 or page_size > 100
    or page_offset is null or page_offset < 0 or page_offset > 10000 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select
    pp.user_id,
    u.email::text,
    p.display_name,
    pp.public_slug,
    pp.public_headline,
    pp.status,
    pp.onboarding_step,
    count(pd.id),
    pp.created_at
  from public.provider_profiles pp
  join auth.users u on u.id = pp.user_id
  left join public.profiles p on p.id = pp.user_id
  left join public.provider_documents pd on pd.user_id = pp.user_id
  where (requested_status is null or pp.status = requested_status)
    and (
      nullif(btrim(search_text), '') is null
      or coalesce(u.email, '') ilike '%' || btrim(search_text) || '%'
      or coalesce(p.display_name, '') ilike '%' || btrim(search_text) || '%'
      or coalesce(pp.public_slug, '') ilike '%' || btrim(search_text) || '%'
    )
  group by pp.user_id, u.email, p.display_name, pp.public_slug, pp.public_headline,
    pp.status, pp.onboarding_step, pp.created_at
  order by pp.created_at desc, pp.user_id desc
  limit page_size
  offset page_offset;
end;
$$;

create or replace function public.get_admin_provider_detail(target_provider_user_id uuid)
returns table (
  provider_user_id uuid,
  email text,
  display_name text,
  public_slug text,
  public_headline text,
  status public.provider_status,
  onboarding_step smallint,
  marketplace_paused boolean,
  availability_paused boolean,
  document_count bigint,
  service_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if target_provider_user_id is null then
    raise exception using errcode = '22023', message = 'provider id is required';
  end if;

  return query
  select
    pp.user_id,
    u.email::text,
    p.display_name,
    pp.public_slug,
    pp.public_headline,
    pp.status,
    pp.onboarding_step,
    pp.marketplace_paused,
    pp.availability_paused,
    (select count(*) from public.provider_documents pd where pd.user_id = pp.user_id),
    (select count(*) from public.services s where s.provider_user_id = pp.user_id),
    pp.created_at,
    pp.updated_at
  from public.provider_profiles pp
  join auth.users u on u.id = pp.user_id
  left join public.profiles p on p.id = pp.user_id
  where pp.user_id = target_provider_user_id;
end;
$$;

create or replace function public.list_admin_jobs(
  requested_status public.job_status default null,
  search_text text default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  job_id uuid,
  status public.job_status,
  service_id uuid,
  service_title text,
  client_user_id uuid,
  client_display_name text,
  provider_user_id uuid,
  provider_display_name text,
  confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if page_size is null or page_size < 1 or page_size > 100
    or page_offset is null or page_offset < 0 or page_offset > 10000 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select
    j.id,
    j.status,
    j.service_id,
    s.title,
    j.client_user_id,
    cp.display_name,
    j.provider_user_id,
    pp.display_name,
    j.confirmed_at,
    j.created_at,
    j.updated_at
  from public.jobs j
  join public.services s on s.id = j.service_id
  left join public.profiles cp on cp.id = j.client_user_id
  left join public.profiles pp on pp.id = j.provider_user_id
  where (requested_status is null or j.status = requested_status)
    and (
      nullif(btrim(search_text), '') is null
      or j.id::text = btrim(search_text)
      or coalesce(s.title, '') ilike '%' || btrim(search_text) || '%'
      or coalesce(cp.display_name, '') ilike '%' || btrim(search_text) || '%'
      or coalesce(pp.display_name, '') ilike '%' || btrim(search_text) || '%'
    )
  order by j.created_at desc, j.id desc
  limit page_size
  offset page_offset;
end;
$$;

create or replace function public.get_admin_job_detail(target_job_id uuid)
returns table (
  job_id uuid,
  status public.job_status,
  client_user_id uuid,
  provider_user_id uuid,
  service_id uuid,
  service_title text,
  proposal_version_id uuid,
  payment_attempt_id uuid,
  scope_snapshot text,
  price_amount bigint,
  currency_code text,
  schedule_type public.schedule_type,
  starts_at timestamptz,
  ends_at timestamptz,
  deadline_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if target_job_id is null then
    raise exception using errcode = '22023', message = 'job id is required';
  end if;

  return query
  select
    j.id,
    j.status,
    j.client_user_id,
    j.provider_user_id,
    j.service_id,
    s.title,
    j.accepted_proposal_version_id,
    j.payment_attempt_id,
    pv.scope_snapshot,
    pv.price_amount,
    pv.currency_code,
    jsv.schedule_type,
    jsv.starts_at,
    jsv.ends_at,
    jsv.deadline_at,
    j.confirmed_at,
    j.created_at,
    j.updated_at
  from public.jobs j
  join public.services s on s.id = j.service_id
  join public.proposal_versions pv on pv.id = j.accepted_proposal_version_id
  left join public.job_schedule_versions jsv on jsv.id = j.current_schedule_version_id
  where j.id = target_job_id;
end;
$$;

create or replace function public.list_admin_audit_events(
  before_created_at timestamptz default null,
  page_size integer default 50
)
returns table (
  event_id uuid,
  actor_user_id uuid,
  actor_display_name text,
  action_type text,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();

  if page_size is null or page_size < 1 or page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid page size';
  end if;

  return query
  select
    ae.id,
    ae.actor_user_id,
    p.display_name,
    ae.action_type,
    ae.target_type,
    ae.target_id,
    ae.metadata,
    ae.created_at
  from public.admin_audit_events ae
  left join public.profiles p on p.id = ae.actor_user_id
  where before_created_at is null or ae.created_at < before_created_at
  order by ae.created_at desc, ae.id desc
  limit page_size;
end;
$$;

revoke all on function public.list_admin_users(text, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function public.get_admin_user_detail(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_admin_providers(text, public.provider_status, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function public.get_admin_provider_detail(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_admin_jobs(public.job_status, text, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function public.get_admin_job_detail(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_admin_audit_events(timestamptz, integer)
from public, anon, authenticated, service_role;

grant execute on function public.list_admin_users(text, integer, integer)
to authenticated, service_role;
grant execute on function public.get_admin_user_detail(uuid)
to authenticated, service_role;
grant execute on function public.list_admin_providers(text, public.provider_status, integer, integer)
to authenticated, service_role;
grant execute on function public.get_admin_provider_detail(uuid)
to authenticated, service_role;
grant execute on function public.list_admin_jobs(public.job_status, text, integer, integer)
to authenticated, service_role;
grant execute on function public.get_admin_job_detail(uuid)
to authenticated, service_role;
grant execute on function public.list_admin_audit_events(timestamptz, integer)
to authenticated, service_role;
