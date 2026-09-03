-- Phase 09 Task 2: manual identity review authority and immutable decision history.

create table public.provider_identity_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_user_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('APPROVE', 'REJECT')),
  previous_status public.provider_status not null,
  new_status public.provider_status not null,
  reason text check (reason is null or char_length(reason) between 2 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (decision = 'APPROVE' and new_status = 'ACTIVE')
    or (decision = 'REJECT' and new_status = 'REJECTED')
  ),
  check (decision <> 'REJECT' or reason is not null)
);

create index provider_identity_reviews_provider_created_idx
on public.provider_identity_reviews (provider_user_id, created_at desc, id desc);

alter table public.provider_identity_reviews enable row level security;

revoke all privileges on table public.provider_identity_reviews
from public, anon, authenticated, service_role;
grant select, insert on table public.provider_identity_reviews to service_role;

create or replace function public.reject_provider_identity_review_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '42501', message = 'provider identity review history is immutable';
end;
$$;

create trigger provider_identity_reviews_immutable_guard
before update or delete on public.provider_identity_reviews
for each row execute function public.reject_provider_identity_review_mutation();

revoke all on function public.reject_provider_identity_review_mutation()
from public, anon, authenticated, service_role;

create or replace function public.list_admin_identity_queue(
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  provider_user_id uuid,
  email text,
  display_name text,
  legal_name text,
  status public.provider_status,
  document_count bigint,
  submitted_at timestamptz,
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
    pp.user_id,
    u.email::text,
    p.display_name,
    pr.legal_name,
    pp.status,
    count(pd.id),
    max(pd.created_at),
    pp.updated_at
  from public.provider_profiles pp
  join auth.users u on u.id = pp.user_id
  left join public.profiles p on p.id = pp.user_id
  left join public.profile_private pr on pr.user_id = pp.user_id
  left join public.provider_documents pd on pd.user_id = pp.user_id
  where pp.status in ('IDENTITY_PENDING', 'UNDER_REVIEW')
  group by pp.user_id, u.email, p.display_name, pr.legal_name, pp.status, pp.updated_at
  order by coalesce(max(pd.created_at), pp.updated_at) asc, pp.user_id asc
  limit page_size
  offset page_offset;
end;
$$;

create or replace function public.get_admin_identity_case(
  target_provider_user_id uuid
)
returns table (
  provider_user_id uuid,
  email text,
  display_name text,
  legal_name text,
  date_of_birth date,
  dni_number text,
  status public.provider_status,
  documents jsonb,
  review_history jsonb,
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
    pr.legal_name,
    pr.date_of_birth,
    pr.dni_number,
    pp.status,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pd.id,
          'document_type', pd.document_type,
          'mime_type', pd.mime_type,
          'file_size_bytes', pd.file_size_bytes,
          'created_at', pd.created_at
        ) order by pd.created_at asc, pd.id asc
      )
      from public.provider_documents pd
      where pd.user_id = pp.user_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pir.id,
          'reviewer_user_id', pir.reviewer_user_id,
          'decision', pir.decision,
          'previous_status', pir.previous_status,
          'new_status', pir.new_status,
          'reason', pir.reason,
          'created_at', pir.created_at
        ) order by pir.created_at desc, pir.id desc
      )
      from public.provider_identity_reviews pir
      where pir.provider_user_id = pp.user_id
    ), '[]'::jsonb),
    pp.updated_at
  from public.provider_profiles pp
  join auth.users u on u.id = pp.user_id
  left join public.profiles p on p.id = pp.user_id
  left join public.profile_private pr on pr.user_id = pp.user_id
  where pp.user_id = target_provider_user_id;
end;
$$;

create or replace function public.decide_provider_identity_review(
  target_provider_user_id uuid,
  requested_decision text,
  requested_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_provider_status public.provider_status;
  next_provider_status public.provider_status;
  normalized_decision text := upper(btrim(coalesce(requested_decision, '')));
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  created_review_id uuid;
begin
  perform public.require_admin();

  if target_provider_user_id is null then
    raise exception using errcode = '22023', message = 'provider id is required';
  end if;

  if target_provider_user_id = actor_user_id then
    raise exception using errcode = '42501', message = 'provider cannot review their own identity';
  end if;

  if normalized_decision not in ('APPROVE', 'REJECT') then
    raise exception using errcode = '22023', message = 'invalid identity review decision';
  end if;

  if normalized_reason is not null and char_length(normalized_reason) > 1000 then
    raise exception using errcode = '22023', message = 'identity review reason is too long';
  end if;

  if normalized_decision = 'REJECT'
    and (normalized_reason is null or char_length(normalized_reason) < 2) then
    raise exception using errcode = '22023', message = 'rejection reason is required';
  end if;

  if normalized_decision = 'APPROVE'
    and normalized_reason is not null
    and char_length(normalized_reason) < 2 then
    raise exception using errcode = '22023', message = 'identity review reason is invalid';
  end if;

  select pp.status
  into previous_provider_status
  from public.provider_profiles pp
  where pp.user_id = target_provider_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'provider not found';
  end if;

  if previous_provider_status not in ('IDENTITY_PENDING', 'UNDER_REVIEW') then
    raise exception using errcode = '55000', message = 'provider is not awaiting identity review';
  end if;

  next_provider_status := case
    when normalized_decision = 'APPROVE' then 'ACTIVE'::public.provider_status
    else 'REJECTED'::public.provider_status
  end;

  update public.provider_profiles
  set status = next_provider_status,
      updated_at = timezone('utc', now())
  where user_id = target_provider_user_id;

  insert into public.provider_identity_reviews (
    provider_user_id,
    reviewer_user_id,
    decision,
    previous_status,
    new_status,
    reason
  ) values (
    target_provider_user_id,
    actor_user_id,
    normalized_decision,
    previous_provider_status,
    next_provider_status,
    normalized_reason
  )
  returning id into created_review_id;

  insert into public.admin_audit_events (
    actor_user_id,
    action_type,
    target_type,
    target_id,
    metadata
  ) values (
    actor_user_id,
    case
      when normalized_decision = 'APPROVE' then 'IDENTITY_REVIEW_APPROVED'
      else 'IDENTITY_REVIEW_REJECTED'
    end,
    'PROVIDER',
    target_provider_user_id,
    jsonb_build_object(
      'identity_review_id', created_review_id,
      'decision', normalized_decision,
      'previous_status', previous_provider_status,
      'new_status', next_provider_status
    )
  );

  return created_review_id;
end;
$$;

revoke all on function public.list_admin_identity_queue(integer, integer)
from public, anon, authenticated, service_role;
revoke all on function public.get_admin_identity_case(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.decide_provider_identity_review(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.list_admin_identity_queue(integer, integer)
to authenticated, service_role;
grant execute on function public.get_admin_identity_case(uuid)
to authenticated, service_role;
grant execute on function public.decide_provider_identity_review(uuid, text, text)
to authenticated, service_role;
