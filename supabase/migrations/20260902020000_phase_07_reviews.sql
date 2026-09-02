-- Phase 07: verified client-to-provider reviews, provider replies and private reports.
-- Review eligibility and anti-manipulation are server-authoritative.

create type public.review_report_reason as enum (
  'THREATS',
  'INSULTS',
  'PRIVATE_INFORMATION',
  'DISCRIMINATION',
  'IRRELEVANT_CONTENT',
  'EXTORTION',
  'ABUSE',
  'OTHER'
);

create table public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  skill_id uuid not null references public.skills(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  quality_rating smallint check (quality_rating is null or quality_rating between 1 and 5),
  punctuality_rating smallint check (punctuality_rating is null or punctuality_rating between 1 and 5),
  communication_rating smallint check (communication_rating is null or communication_rating between 1 and 5),
  review_text text check (
    review_text is null
    or char_length(btrim(review_text)) between 2 and 2000
  ),
  service_title_snapshot text not null
    check (char_length(btrim(service_title_snapshot)) between 3 and 120),
  skill_name_snapshot text not null
    check (char_length(btrim(skill_name_snapshot)) between 2 and 120),
  category_name_snapshot text not null
    check (char_length(btrim(category_name_snapshot)) between 2 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  check (reviewer_user_id <> provider_user_id)
);

create table public.review_replies (
  id uuid primary key default extensions.gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  reply_text text not null check (char_length(btrim(reply_text)) between 2 and 1500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger review_replies_set_updated_at
before update on public.review_replies
for each row execute function public.set_updated_at();

create table public.review_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reason public.review_report_reason not null,
  details text check (details is null or char_length(btrim(details)) between 2 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  unique (review_id, reporter_user_id)
);

create index reviews_provider_created_idx
on public.reviews (provider_user_id, created_at desc, id desc);

create index reviews_service_created_idx
on public.reviews (service_id, created_at desc, id desc);

create index reviews_skill_created_idx
on public.reviews (skill_id, created_at desc, id desc);

create index review_reports_review_created_idx
on public.review_reports (review_id, created_at desc, id desc);

create or replace function public.guard_review_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '42501', message = 'published reviews are immutable';
end;
$$;

create trigger reviews_immutable_guard
before update or delete on public.reviews
for each row execute function public.guard_review_immutable();

alter table public.reviews enable row level security;
alter table public.review_replies enable row level security;
alter table public.review_reports enable row level security;

create policy reviews_participant_select
on public.reviews
for select
to authenticated
using (auth.uid() in (reviewer_user_id, provider_user_id));

create policy review_replies_participant_select
on public.review_replies
for select
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_replies.review_id
      and auth.uid() in (r.reviewer_user_id, r.provider_user_id)
  )
);

create policy review_reports_owner_select
on public.review_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

revoke all on table public.reviews from public, anon, authenticated;
revoke all on table public.review_replies from public, anon, authenticated;
revoke all on table public.review_reports from public, anon, authenticated;

grant select on table public.reviews to authenticated;
grant select on table public.review_replies to authenticated;
grant select on table public.review_reports to authenticated;

grant all on table public.reviews to service_role;
grant all on table public.review_replies to service_role;
grant all on table public.review_reports to service_role;

create or replace function public.create_job_review(
  target_job_id uuid,
  requested_rating integer,
  requested_review_text text default null,
  requested_quality_rating integer default null,
  requested_punctuality_rating integer default null,
  requested_communication_rating integer default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  service_title_snapshot_value text;
  target_skill_id uuid;
  target_skill_name text;
  target_category_id uuid;
  target_category_name text;
  normalized_review_text text := nullif(btrim(requested_review_text), '');
  created_review_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if requested_rating is null or requested_rating not between 1 and 5 then
    raise exception using errcode = '22023', message = 'rating must be between 1 and 5';
  end if;

  if requested_quality_rating is not null and requested_quality_rating not between 1 and 5 then
    raise exception using errcode = '22023', message = 'quality rating must be between 1 and 5';
  end if;

  if requested_punctuality_rating is not null and requested_punctuality_rating not between 1 and 5 then
    raise exception using errcode = '22023', message = 'punctuality rating must be between 1 and 5';
  end if;

  if requested_communication_rating is not null and requested_communication_rating not between 1 and 5 then
    raise exception using errcode = '22023', message = 'communication rating must be between 1 and 5';
  end if;

  if normalized_review_text is not null
     and char_length(normalized_review_text) not between 2 and 2000 then
    raise exception using errcode = '22023', message = 'review text must contain between 2 and 2000 characters';
  end if;

  select * into target_job
  from public.jobs
  where id = target_job_id
  for update;

  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;

  if caller_id <> target_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the job client can review the provider';
  end if;

  if target_job.client_user_id = target_job.provider_user_id then
    raise exception using errcode = '42501', message = 'self review is not allowed';
  end if;

  if target_job.status <> 'COMPLETED' then
    raise exception using errcode = '42501', message = 'only completed jobs can be reviewed';
  end if;

  if exists (select 1 from public.reviews r where r.job_id = target_job.id) then
    raise exception using errcode = '23505', message = 'job already has a review';
  end if;

  select pv.service_title_snapshot
    into service_title_snapshot_value
  from public.proposal_versions pv
  where pv.id = target_job.accepted_proposal_version_id;

  select s.skill_id, sk.name, sk.category_id, c.name
    into target_skill_id, target_skill_name, target_category_id, target_category_name
  from public.services s
  join public.skills sk on sk.id = s.skill_id
  join public.categories c on c.id = sk.category_id
  where s.id = target_job.service_id;

  if service_title_snapshot_value is null
     or target_skill_id is null
     or target_category_id is null then
    raise exception using errcode = 'P0002', message = 'job review context is unavailable';
  end if;

  insert into public.reviews (
    job_id,
    service_id,
    skill_id,
    category_id,
    reviewer_user_id,
    provider_user_id,
    rating,
    quality_rating,
    punctuality_rating,
    communication_rating,
    review_text,
    service_title_snapshot,
    skill_name_snapshot,
    category_name_snapshot
  ) values (
    target_job.id,
    target_job.service_id,
    target_skill_id,
    target_category_id,
    target_job.client_user_id,
    target_job.provider_user_id,
    requested_rating::smallint,
    requested_quality_rating::smallint,
    requested_punctuality_rating::smallint,
    requested_communication_rating::smallint,
    normalized_review_text,
    service_title_snapshot_value,
    target_skill_name,
    target_category_name
  )
  returning id into created_review_id;

  return created_review_id;
end;
$$;

create or replace function public.upsert_provider_review_reply(
  target_review_id uuid,
  requested_reply_text text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_review public.reviews%rowtype;
  normalized_reply text := btrim(requested_reply_text);
  reply_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if normalized_reply is null or char_length(normalized_reply) not between 2 and 1500 then
    raise exception using errcode = '22023', message = 'reply text must contain between 2 and 1500 characters';
  end if;

  select * into target_review
  from public.reviews
  where id = target_review_id;

  if target_review.id is null then
    raise exception using errcode = 'P0002', message = 'review not found';
  end if;

  if caller_id <> target_review.provider_user_id then
    raise exception using errcode = '42501', message = 'only the reviewed provider can reply';
  end if;

  insert into public.review_replies (
    review_id,
    provider_user_id,
    reply_text
  ) values (
    target_review.id,
    caller_id,
    normalized_reply
  )
  on conflict (review_id) do update
    set reply_text = excluded.reply_text,
        provider_user_id = excluded.provider_user_id
  returning id into reply_id;

  return reply_id;
end;
$$;

create or replace function public.report_review(
  target_review_id uuid,
  requested_reason public.review_report_reason,
  requested_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_review public.reviews%rowtype;
  normalized_details text := nullif(btrim(requested_details), '');
  existing_report_id uuid;
  created_report_id uuid;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if requested_reason is null then
    raise exception using errcode = '22023', message = 'report reason is required';
  end if;

  if normalized_details is not null
     and char_length(normalized_details) not between 2 and 1000 then
    raise exception using errcode = '22023', message = 'report details must contain between 2 and 1000 characters';
  end if;

  select * into target_review
  from public.reviews
  where id = target_review_id;

  if target_review.id is null then
    raise exception using errcode = 'P0002', message = 'review not found';
  end if;

  if caller_id = target_review.reviewer_user_id then
    raise exception using errcode = '42501', message = 'review author cannot report their own review';
  end if;

  select rr.id into existing_report_id
  from public.review_reports rr
  where rr.review_id = target_review.id
    and rr.reporter_user_id = caller_id;

  if existing_report_id is not null then
    return existing_report_id;
  end if;

  insert into public.review_reports (
    review_id,
    reporter_user_id,
    reason,
    details
  ) values (
    target_review.id,
    caller_id,
    requested_reason,
    normalized_details
  )
  returning id into created_report_id;

  return created_report_id;
end;
$$;

revoke all on function public.create_job_review(uuid, integer, text, integer, integer, integer)
from public, anon, authenticated, service_role;
grant execute on function public.create_job_review(uuid, integer, text, integer, integer, integer)
to authenticated, service_role;

revoke all on function public.upsert_provider_review_reply(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.upsert_provider_review_reply(uuid, text)
to authenticated, service_role;

revoke all on function public.report_review(uuid, public.review_report_reason, text)
from public, anon, authenticated, service_role;
grant execute on function public.report_review(uuid, public.review_report_reason, text)
to authenticated, service_role;
