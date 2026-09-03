-- Phase 09 Task 4: reports, reversible account restrictions and preserved moderation evidence.

create table public.moderation_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  source_type text not null check (source_type in ('CONVERSATION_REPORT', 'REVIEW_REPORT')),
  source_report_id uuid not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  resolution text check (resolution is null or char_length(btrim(resolution)) between 2 and 1000),
  resolved_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_type, source_report_id),
  check (
    (status = 'OPEN' and resolution is null and resolved_by is null and resolved_at is null)
    or (status = 'RESOLVED' and resolution is not null and resolved_by is not null and resolved_at is not null)
  )
);

create table public.account_restrictions (
  id uuid primary key default extensions.gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('RESTRICTED', 'SUSPENDED')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  previous_provider_status public.provider_status,
  previous_marketplace_paused boolean,
  previous_availability_paused boolean,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_reason text check (revoked_reason is null or char_length(btrim(revoked_reason)) between 2 and 1000),
  revoked_at timestamptz,
  check (
    (revoked_at is null and revoked_by is null and revoked_reason is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

create unique index account_restrictions_one_active_idx
on public.account_restrictions (target_user_id)
where revoked_at is null;

create index account_restrictions_target_created_idx
on public.account_restrictions (target_user_id, created_at desc, id desc);

create table public.review_moderation_state (
  review_id uuid primary key references public.reviews(id) on delete restrict,
  disposition text not null default 'VISIBLE'
    check (disposition in ('VISIBLE', 'HIDDEN_POLICY', 'RESTORED')),
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 1000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (disposition <> 'HIDDEN_POLICY' or reason is not null)
);

create table public.message_moderation_state (
  message_id uuid primary key references public.messages(id) on delete restrict,
  disposition text not null default 'VISIBLE'
    check (disposition in ('VISIBLE', 'HIDDEN_POLICY', 'RESTORED')),
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 1000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (disposition <> 'HIDDEN_POLICY' or reason is not null)
);

alter table public.moderation_cases enable row level security;
alter table public.account_restrictions enable row level security;
alter table public.review_moderation_state enable row level security;
alter table public.message_moderation_state enable row level security;

revoke all privileges on table public.moderation_cases from public, anon, authenticated, service_role;
revoke all privileges on table public.account_restrictions from public, anon, authenticated, service_role;
revoke all privileges on table public.review_moderation_state from public, anon, authenticated, service_role;
revoke all privileges on table public.message_moderation_state from public, anon, authenticated, service_role;

grant select, insert, update on table public.moderation_cases to service_role;
grant select, insert, update on table public.account_restrictions to service_role;
grant select, insert, update on table public.review_moderation_state to service_role;
grant select, insert, update on table public.message_moderation_state to service_role;

create trigger moderation_cases_set_updated_at
before update on public.moderation_cases
for each row execute function public.set_updated_at();
create trigger review_moderation_state_set_updated_at
before update on public.review_moderation_state
for each row execute function public.set_updated_at();
create trigger message_moderation_state_set_updated_at
before update on public.message_moderation_state
for each row execute function public.set_updated_at();

-- A report is private to its reporter. Admins use the guarded report queue RPC instead.
drop policy if exists conversation_reports_select_participant on public.conversation_reports;
create policy conversation_reports_select_owner
on public.conversation_reports for select to authenticated
using (reporter_user_id = auth.uid());

create or replace function public.is_review_publicly_visible(target_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select not exists (
    select 1
    from public.review_moderation_state rms
    where rms.review_id = target_review_id
      and rms.disposition = 'HIDDEN_POLICY'
  );
$$;

revoke all on function public.is_review_publicly_visible(uuid)
from public, anon, authenticated, service_role;

create or replace function public.is_message_visible(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select not exists (
    select 1
    from public.message_moderation_state mms
    where mms.message_id = target_message_id
      and mms.disposition = 'HIDDEN_POLICY'
  );
$$;

revoke all on function public.is_message_visible(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_message_visible(uuid) to authenticated, service_role;

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant
on public.messages for select to authenticated
using (
  public.is_conversation_participant(conversation_id)
  and public.is_message_visible(id)
);

create or replace function public.is_account_restricted(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.account_restrictions ar
    where ar.target_user_id = target_user_id
      and ar.revoked_at is null
  );
$$;

revoke all on function public.is_account_restricted(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_account_restricted(uuid) to authenticated, service_role;

create or replace function public.guard_active_account_restriction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is not null and public.is_account_restricted(caller_id) then
    raise exception using errcode = '42501', message = 'account restricted by moderation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_active_account_restriction()
from public, anon, authenticated, service_role;

create trigger messages_account_restriction_guard
before insert or update or delete on public.messages
for each row execute function public.guard_active_account_restriction();
create trigger services_account_restriction_guard
before insert or update or delete on public.services
for each row execute function public.guard_active_account_restriction();
create trigger proposals_account_restriction_guard
before insert or update or delete on public.proposals
for each row execute function public.guard_active_account_restriction();
create trigger jobs_account_restriction_guard
before insert or update or delete on public.jobs
for each row execute function public.guard_active_account_restriction();
create trigger reviews_account_restriction_guard
before insert or update or delete on public.reviews
for each row execute function public.guard_active_account_restriction();
create trigger review_replies_account_restriction_guard
before insert or update or delete on public.review_replies
for each row execute function public.guard_active_account_restriction();

create or replace function public.list_admin_reports(
  requested_status text default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  report_type text,
  report_id uuid,
  target_id uuid,
  reporter_user_id uuid,
  category text,
  reason text,
  case_id uuid,
  case_status text,
  resolution text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_status text := nullif(upper(btrim(coalesce(requested_status, ''))), '');
begin
  perform public.require_admin();

  if normalized_status is not null and normalized_status not in ('OPEN', 'RESOLVED') then
    raise exception using errcode = '22023', message = 'invalid report status';
  end if;
  if page_size is null or page_size < 1 or page_size > 100
    or page_offset is null or page_offset < 0 or page_offset > 10000 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  with reports as (
    select
      'CONVERSATION_REPORT'::text as report_type,
      cr.id as report_id,
      cr.conversation_id as target_id,
      cr.reporter_user_id,
      cr.category::text as category,
      cr.reason::text as reason,
      cr.created_at
    from public.conversation_reports cr
    union all
    select
      'REVIEW_REPORT'::text,
      rr.id,
      rr.review_id,
      rr.reporter_user_id,
      rr.reason::text,
      rr.details::text,
      rr.created_at
    from public.review_reports rr
  )
  select
    r.report_type,
    r.report_id,
    r.target_id,
    r.reporter_user_id,
    r.category,
    r.reason,
    mc.id,
    coalesce(mc.status, 'OPEN'::text),
    mc.resolution,
    r.created_at
  from reports r
  left join public.moderation_cases mc
    on mc.source_type = r.report_type
   and mc.source_report_id = r.report_id
  where normalized_status is null or coalesce(mc.status, 'OPEN') = normalized_status
  order by r.created_at asc, r.report_id asc
  limit page_size
  offset page_offset;
end;
$$;

create or replace function public.admin_resolve_report(
  requested_report_type text,
  target_report_id uuid,
  requested_resolution text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_type text := upper(btrim(coalesce(requested_report_type, '')));
  normalized_resolution text := nullif(btrim(coalesce(requested_resolution, '')), '');
  resolved_case_id uuid;
begin
  perform public.require_admin();

  if normalized_type not in ('CONVERSATION_REPORT', 'REVIEW_REPORT') then
    raise exception using errcode = '22023', message = 'invalid report type';
  end if;
  if target_report_id is null then
    raise exception using errcode = '22023', message = 'report id is required';
  end if;
  if normalized_resolution is null or char_length(normalized_resolution) not between 2 and 1000 then
    raise exception using errcode = '22023', message = 'resolution is required';
  end if;

  if normalized_type = 'CONVERSATION_REPORT' then
    if not exists (select 1 from public.conversation_reports where id = target_report_id) then
      raise exception using errcode = 'P0002', message = 'conversation report not found';
    end if;
  else
    if not exists (select 1 from public.review_reports where id = target_report_id) then
      raise exception using errcode = 'P0002', message = 'review report not found';
    end if;
  end if;

  insert into public.moderation_cases (
    source_type, source_report_id, status, resolution, resolved_by, resolved_at
  ) values (
    normalized_type, target_report_id, 'RESOLVED', normalized_resolution,
    actor_user_id, timezone('utc', now())
  )
  on conflict (source_type, source_report_id) do update
    set status = 'RESOLVED',
        resolution = excluded.resolution,
        resolved_by = excluded.resolved_by,
        resolved_at = excluded.resolved_at,
        updated_at = timezone('utc', now())
  returning id into resolved_case_id;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'REPORT_RESOLVED',
    normalized_type,
    target_report_id,
    jsonb_build_object('case_id', resolved_case_id, 'resolution', normalized_resolution)
  );

  return resolved_case_id;
end;
$$;

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

  if target_user_id is null or not exists (select 1 from auth.users where id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'user not found';
  end if;
  if target_user_id = actor_user_id then
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
  where ar.target_user_id = target_user_id and ar.revoked_at is null
  for update;

  select pp.status, pp.marketplace_paused, pp.availability_paused
    into current_status, current_marketplace_paused, current_availability_paused
  from public.provider_profiles pp
  where pp.user_id = target_user_id
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
    target_user_id, normalized_kind, normalized_reason, safe_previous_status,
    safe_marketplace_paused, safe_availability_paused, actor_user_id
  ) returning id into created_restriction_id;

  if current_status is not null then
    update public.provider_profiles
    set status = normalized_kind::public.provider_status,
        marketplace_paused = true,
        availability_paused = true,
        updated_at = timezone('utc', now())
    where user_id = target_user_id;
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    case when normalized_kind = 'SUSPENDED' then 'ACCOUNT_SUSPENDED' else 'ACCOUNT_RESTRICTED' end,
    'USER',
    target_user_id,
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
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  active_restriction public.account_restrictions%rowtype;
  restored_status public.provider_status;
begin
  perform public.require_admin();

  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception using errcode = '22023', message = 'restore reason is too long';
  end if;

  select * into active_restriction
  from public.account_restrictions ar
  where ar.target_user_id = target_user_id and ar.revoked_at is null
  for update;

  if active_restriction.id is null then
    raise exception using errcode = 'P0002', message = 'active account restriction not found';
  end if;

  update public.account_restrictions
  set revoked_by = actor_user_id,
      revoked_reason = coalesce(normalized_reason, 'Restaurada por administración.'),
      revoked_at = timezone('utc', now())
  where id = active_restriction.id;

  if exists (select 1 from public.provider_profiles where user_id = target_user_id) then
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
    where user_id = target_user_id;
  end if;

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'ACCOUNT_RESTORED',
    'USER',
    target_user_id,
    jsonb_build_object(
      'restriction_id', active_restriction.id,
      'previous_kind', active_restriction.kind,
      'restored_provider_status', restored_status
    )
  );

  return active_restriction.id;
end;
$$;

create or replace function public.admin_set_review_moderation(
  target_review_id uuid,
  requested_disposition text,
  requested_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_disposition text := upper(btrim(coalesce(requested_disposition, '')));
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
begin
  perform public.require_admin();

  if not exists (select 1 from public.reviews where id = target_review_id) then
    raise exception using errcode = 'P0002', message = 'review not found';
  end if;
  if normalized_disposition not in ('VISIBLE', 'HIDDEN_POLICY', 'RESTORED') then
    raise exception using errcode = '22023', message = 'invalid review disposition';
  end if;
  if normalized_disposition = 'HIDDEN_POLICY'
    and (normalized_reason is null or char_length(normalized_reason) not between 2 and 1000) then
    raise exception using errcode = '22023', message = 'policy reason is required';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception using errcode = '22023', message = 'review moderation reason is too long';
  end if;

  insert into public.review_moderation_state (review_id, disposition, reason, updated_by)
  values (target_review_id, normalized_disposition, normalized_reason, actor_user_id)
  on conflict (review_id) do update
    set disposition = excluded.disposition,
        reason = excluded.reason,
        updated_by = excluded.updated_by,
        updated_at = timezone('utc', now());

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    case when normalized_disposition = 'HIDDEN_POLICY' then 'REVIEW_HIDDEN_POLICY' else 'REVIEW_RESTORED' end,
    'REVIEW',
    target_review_id,
    jsonb_build_object('disposition', normalized_disposition)
  );
end;
$$;

create or replace function public.admin_set_message_moderation(
  target_message_id uuid,
  requested_disposition text,
  requested_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_disposition text := upper(btrim(coalesce(requested_disposition, '')));
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
begin
  perform public.require_admin();

  if not exists (select 1 from public.messages where id = target_message_id) then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;
  if normalized_disposition not in ('VISIBLE', 'HIDDEN_POLICY', 'RESTORED') then
    raise exception using errcode = '22023', message = 'invalid message disposition';
  end if;
  if normalized_disposition = 'HIDDEN_POLICY'
    and (normalized_reason is null or char_length(normalized_reason) not between 2 and 1000) then
    raise exception using errcode = '22023', message = 'policy reason is required';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception using errcode = '22023', message = 'message moderation reason is too long';
  end if;

  insert into public.message_moderation_state (message_id, disposition, reason, updated_by)
  values (target_message_id, normalized_disposition, normalized_reason, actor_user_id)
  on conflict (message_id) do update
    set disposition = excluded.disposition,
        reason = excluded.reason,
        updated_by = excluded.updated_by,
        updated_at = timezone('utc', now());

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    case when normalized_disposition = 'HIDDEN_POLICY' then 'MESSAGE_HIDDEN_POLICY' else 'MESSAGE_RESTORED' end,
    'MESSAGE',
    target_message_id,
    jsonb_build_object('disposition', normalized_disposition)
  );
end;
$$;

create or replace function public.list_admin_catalog_categories()
returns table (
  category_id uuid,
  slug text,
  name text,
  description text,
  sort_order smallint,
  is_active boolean,
  skill_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  return query
  select c.id, c.slug, c.name, c.description, c.sort_order, c.is_active, count(s.id)
  from public.categories c
  left join public.skills s on s.category_id = c.id
  group by c.id, c.slug, c.name, c.description, c.sort_order, c.is_active
  order by c.sort_order, c.name, c.id;
end;
$$;

create or replace function public.list_admin_catalog_skills(target_category_id uuid default null)
returns table (
  skill_id uuid,
  category_id uuid,
  category_name text,
  slug text,
  name text,
  description text,
  sort_order smallint,
  is_active boolean,
  service_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  return query
  select s.id, s.category_id, c.name, s.slug, s.name, s.description, s.sort_order, s.is_active, count(svc.id)
  from public.skills s
  join public.categories c on c.id = s.category_id
  left join public.services svc on svc.skill_id = s.id
  where target_category_id is null or s.category_id = target_category_id
  group by s.id, s.category_id, c.name, s.slug, s.name, s.description, s.sort_order, s.is_active
  order by c.sort_order, c.name, s.sort_order, s.name, s.id;
end;
$$;

create or replace function public.list_admin_services(
  search_text text default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  service_id uuid,
  provider_user_id uuid,
  provider_display_name text,
  service_title text,
  service_slug text,
  skill_name text,
  is_published boolean,
  is_paused boolean,
  moderation_state text,
  moderation_reason text,
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
    svc.id, svc.provider_user_id, p.display_name, svc.title, svc.public_slug, sk.name,
    svc.is_published, svc.is_paused, coalesce(sms.state, 'CLEAR'), sms.reason, svc.updated_at
  from public.services svc
  join public.skills sk on sk.id = svc.skill_id
  left join public.profiles p on p.id = svc.provider_user_id
  left join public.service_moderation_state sms on sms.service_id = svc.id
  where nullif(btrim(search_text), '') is null
    or svc.title ilike '%' || btrim(search_text) || '%'
    or svc.public_slug ilike '%' || btrim(search_text) || '%'
    or coalesce(p.display_name, '') ilike '%' || btrim(search_text) || '%'
  order by svc.updated_at desc, svc.id desc
  limit page_size offset page_offset;
end;
$$;

revoke all on function public.list_admin_reports(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.admin_resolve_report(text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_account_restriction(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_restore_account(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_review_moderation(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_message_moderation(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.list_admin_catalog_categories() from public, anon, authenticated, service_role;
revoke all on function public.list_admin_catalog_skills(uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_admin_services(text, integer, integer) from public, anon, authenticated, service_role;

grant execute on function public.list_admin_reports(text, integer, integer) to authenticated, service_role;
grant execute on function public.admin_resolve_report(text, uuid, text) to authenticated, service_role;
grant execute on function public.admin_set_account_restriction(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_restore_account(uuid, text) to authenticated, service_role;
grant execute on function public.admin_set_review_moderation(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_set_message_moderation(uuid, text, text) to authenticated, service_role;
grant execute on function public.list_admin_catalog_categories() to authenticated, service_role;
grant execute on function public.list_admin_catalog_skills(uuid) to authenticated, service_role;
grant execute on function public.list_admin_services(text, integer, integer) to authenticated, service_role;

-- Public reputation excludes policy-hidden reviews while immutable source rows remain preserved.
create or replace function public.provider_reputation_metrics_internal(
  target_provider_id uuid,
  target_service_id uuid default null,
  target_skill_id uuid default null
)
returns table (
  rating_average numeric,
  adjusted_rating numeric,
  review_count bigint,
  quality_rating_average numeric,
  punctuality_rating_average numeric,
  communication_rating_average numeric,
  completed_jobs bigint,
  observed_jobs bigint,
  completion_rate numeric,
  cancellation_count bigint,
  cancellation_rate numeric,
  no_show_count bigint,
  no_show_rate numeric,
  repeat_client_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with review_stats as (
    select
      count(*)::bigint as review_count,
      avg(r.rating::numeric) as rating_average,
      avg(r.quality_rating::numeric) as quality_rating_average,
      avg(r.punctuality_rating::numeric) as punctuality_rating_average,
      avg(r.communication_rating::numeric) as communication_rating_average
    from public.reviews r
    where r.provider_user_id = target_provider_id
      and public.is_review_publicly_visible(r.id)
      and (target_service_id is null or r.service_id = target_service_id)
      and (target_skill_id is null or r.skill_id = target_skill_id)
  ),
  marketplace_prior as (
    select coalesce(avg(r.rating::numeric), 4.2::numeric) as prior_average
    from public.reviews r
    where public.is_review_publicly_visible(r.id)
  ),
  filtered_jobs as (
    select j.id, j.client_user_id, j.status
    from public.jobs j
    join public.services s on s.id = j.service_id
    where j.provider_user_id = target_provider_id
      and (target_service_id is null or j.service_id = target_service_id)
      and (target_skill_id is null or s.skill_id = target_skill_id)
  ),
  job_stats as (
    select
      count(*) filter (where status = 'COMPLETED')::bigint as completed_jobs,
      count(*) filter (where status in ('COMPLETED', 'CANCELLED', 'NO_SHOW'))::bigint as observed_jobs,
      count(*) filter (where status = 'CANCELLED')::bigint as cancellation_count,
      count(*) filter (where status = 'NO_SHOW')::bigint as no_show_count
    from filtered_jobs
  ),
  repeat_clients as (
    select count(*)::bigint as repeat_client_count
    from (
      select client_user_id
      from filtered_jobs
      where status = 'COMPLETED'
      group by client_user_id
      having count(*) >= 2
    ) repeated
  )
  select
    case when reviews.review_count = 0 then null else round(reviews.rating_average, 2) end,
    case
      when reviews.review_count = 0 then null
      else round((reviews.rating_average * reviews.review_count::numeric + prior.prior_average * 8::numeric) /
        (reviews.review_count::numeric + 8::numeric), 4)
    end,
    reviews.review_count,
    case when reviews.quality_rating_average is null then null else round(reviews.quality_rating_average, 2) end,
    case when reviews.punctuality_rating_average is null then null else round(reviews.punctuality_rating_average, 2) end,
    case when reviews.communication_rating_average is null then null else round(reviews.communication_rating_average, 2) end,
    jobs.completed_jobs,
    jobs.observed_jobs,
    case when jobs.observed_jobs = 0 then null else round(jobs.completed_jobs::numeric / jobs.observed_jobs::numeric, 4) end,
    jobs.cancellation_count,
    case when jobs.observed_jobs = 0 then null else round(jobs.cancellation_count::numeric / jobs.observed_jobs::numeric, 4) end,
    jobs.no_show_count,
    case when jobs.observed_jobs = 0 then null else round(jobs.no_show_count::numeric / jobs.observed_jobs::numeric, 4) end,
    repeated.repeat_client_count
  from review_stats reviews
  cross join marketplace_prior prior
  cross join job_stats jobs
  cross join repeat_clients repeated;
$$;

revoke all on function public.provider_reputation_metrics_internal(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.list_public_provider_reviews(
  target_provider_slug text,
  skill_filter text default null,
  service_filter text default null,
  before_created_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 20
)
returns table (
  review_id uuid,
  reviewer_display_name text,
  rating smallint,
  quality_rating smallint,
  punctuality_rating smallint,
  communication_rating smallint,
  review_text text,
  service_title text,
  service_slug text,
  skill_name text,
  skill_slug text,
  category_name text,
  category_slug text,
  provider_reply text,
  provider_replied_at timestamptz,
  created_at timestamptz,
  has_more boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  bounded_page_size integer := least(greatest(coalesce(page_size, 20), 1), 50);
begin
  return query
  with eligible as (
    select
      review.id as review_id,
      reviewer.display_name as reviewer_display_name,
      review.rating,
      review.quality_rating,
      review.punctuality_rating,
      review.communication_rating,
      review.review_text,
      review.service_title_snapshot as service_title,
      service.public_slug as service_slug,
      review.skill_name_snapshot as skill_name,
      skill.slug as skill_slug,
      review.category_name_snapshot as category_name,
      category.slug as category_slug,
      reply.reply_text as provider_reply,
      reply.updated_at as provider_replied_at,
      review.created_at
    from public.reviews review
    join public.provider_profiles provider on provider.user_id = review.provider_user_id
    join public.profiles reviewer on reviewer.id = review.reviewer_user_id
    join public.services service on service.id = review.service_id
    join public.skills skill on skill.id = review.skill_id
    join public.categories category on category.id = review.category_id
    left join public.review_replies reply on reply.review_id = review.id
    where provider.public_slug = target_provider_slug
      and provider.status = 'ACTIVE'
      and not provider.marketplace_paused
      and public.is_review_publicly_visible(review.id)
      and (skill_filter is null or skill.slug = skill_filter)
      and (service_filter is null or service.public_slug = service_filter)
      and (
        before_created_at is null
        or review.created_at < before_created_at
        or (review.created_at = before_created_at and before_id is not null and review.id < before_id)
      )
    order by review.created_at desc, review.id desc
    limit bounded_page_size + 1
  ),
  paged as (
    select eligible.*,
      row_number() over (order by eligible.created_at desc, eligible.review_id desc) as page_row,
      count(*) over () > bounded_page_size as page_has_more
    from eligible
  )
  select
    paged.review_id, paged.reviewer_display_name, paged.rating,
    paged.quality_rating, paged.punctuality_rating, paged.communication_rating,
    paged.review_text, paged.service_title, paged.service_slug,
    paged.skill_name, paged.skill_slug, paged.category_name, paged.category_slug,
    paged.provider_reply, paged.provider_replied_at, paged.created_at, paged.page_has_more
  from paged
  where paged.page_row <= bounded_page_size
  order by paged.created_at desc, paged.review_id desc;
end;
$$;

revoke all on function public.list_public_provider_reviews(text, text, text, timestamptz, uuid, integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_public_provider_reviews(text, text, text, timestamptz, uuid, integer)
to anon, authenticated, service_role;
