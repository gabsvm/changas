-- Phase 07: account reputation reads and rehire flow.
-- Rehire always creates a new proposal from current service terms; historical Jobs remain immutable.

create or replace function public.create_rehire_proposal(
  target_job_id uuid
)
returns table (
  conversation_id uuid,
  proposal_id uuid,
  proposal_kind public.proposal_kind,
  proposal_status public.proposal_status
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  source_job public.jobs%rowtype;
  provider_slug_value text;
  service_slug_value text;
  current_price_model public.price_model;
  current_schedule_type public.schedule_type;
  created_conversation_id uuid;
  created_proposal_id uuid;
  created_kind public.proposal_kind;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into source_job
  from public.jobs
  where id = target_job_id
  for share;

  if source_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;

  if caller_id <> source_job.client_user_id then
    raise exception using errcode = '42501', message = 'only the original client can rehire';
  end if;

  if source_job.status <> 'COMPLETED' then
    raise exception using errcode = '42501', message = 'only completed jobs can be rehired';
  end if;

  select
    provider.public_slug,
    service.public_slug,
    service.price_model,
    service.schedule_type
  into
    provider_slug_value,
    service_slug_value,
    current_price_model,
    current_schedule_type
  from public.services service
  join public.provider_profiles provider
    on provider.user_id = service.provider_user_id
  where service.id = source_job.service_id
    and service.provider_user_id = source_job.provider_user_id
    and service.is_published
    and not service.is_paused
    and provider.status = 'ACTIVE'
    and not provider.marketplace_paused;

  if provider_slug_value is null or service_slug_value is null then
    raise exception using errcode = 'P0002', message = 'current service is unavailable for rehire';
  end if;

  created_conversation_id := public.start_service_conversation(
    provider_slug_value,
    service_slug_value
  );

  created_kind := case
    when current_price_model = 'FIXED'
      and current_schedule_type = 'UNSCHEDULED'
      then 'DIRECT_BOOKING'::public.proposal_kind
    else 'QUOTE_REQUEST'::public.proposal_kind
  end;

  created_proposal_id := public.create_conversation_proposal(
    target_conversation_id => created_conversation_id,
    requested_kind => created_kind,
    scope_text => null,
    proposed_price_amount => null,
    proposed_schedule_start_at => null,
    proposed_schedule_end_at => null,
    proposed_deadline_at => null,
    proposal_expires_at => null
  );

  return query
  select
    created_conversation_id,
    proposal.id,
    proposal.kind,
    proposal.status
  from public.proposals proposal
  where proposal.id = created_proposal_id;
end;
$$;

revoke all on function public.create_rehire_proposal(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.create_rehire_proposal(uuid)
to authenticated, service_role;

create or replace function public.get_job_review_state(
  target_job_id uuid
)
returns table (
  job_id uuid,
  job_status public.job_status,
  client_user_id uuid,
  provider_user_id uuid,
  review_id uuid,
  rating smallint,
  quality_rating smallint,
  punctuality_rating smallint,
  communication_rating smallint,
  review_text text,
  review_created_at timestamptz,
  provider_reply text,
  provider_replied_at timestamptz,
  reported_by_caller boolean,
  can_review boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  source_job public.jobs%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into source_job
  from public.jobs
  where id = target_job_id;

  if source_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;

  if caller_id not in (source_job.client_user_id, source_job.provider_user_id) then
    raise exception using errcode = '42501', message = 'job review state access denied';
  end if;

  return query
  select
    source_job.id,
    source_job.status,
    source_job.client_user_id,
    source_job.provider_user_id,
    review.id,
    review.rating,
    review.quality_rating,
    review.punctuality_rating,
    review.communication_rating,
    review.review_text,
    review.created_at,
    reply.reply_text,
    reply.updated_at,
    exists (
      select 1
      from public.review_reports report
      where report.review_id = review.id
        and report.reporter_user_id = caller_id
    ),
    caller_id = source_job.client_user_id
      and source_job.status = 'COMPLETED'
      and review.id is null
  from (select 1) seed
  left join public.reviews review on review.job_id = source_job.id
  left join public.review_replies reply on reply.review_id = review.id;
end;
$$;

revoke all on function public.get_job_review_state(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_job_review_state(uuid)
to authenticated, service_role;

create or replace function public.list_my_favorite_providers_v2()
returns table (
  provider_slug text,
  display_name text,
  avatar_url text,
  public_zone text,
  public_headline text,
  bio text,
  rating_average numeric,
  review_count bigint,
  completed_jobs bigint,
  completion_rate numeric,
  repeat_client_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  return query
  select
    provider.public_slug,
    profile.display_name,
    profile.avatar_url,
    profile.public_zone,
    provider.public_headline,
    profile.bio,
    metrics.rating_average,
    metrics.review_count,
    metrics.completed_jobs,
    metrics.completion_rate,
    metrics.repeat_client_count
  from public.provider_favorites favorite
  join public.provider_profiles provider
    on provider.user_id = favorite.provider_user_id
  join public.profiles profile
    on profile.id = provider.user_id
  cross join lateral public.provider_reputation_metrics_internal(
    provider.user_id,
    null,
    null
  ) metrics
  where favorite.user_id = caller_id
    and provider.status = 'ACTIVE'
    and not provider.marketplace_paused
  order by favorite.created_at desc, provider.public_slug;
end;
$$;

revoke all on function public.list_my_favorite_providers_v2()
from public, anon, authenticated, service_role;
grant execute on function public.list_my_favorite_providers_v2()
to authenticated, service_role;
