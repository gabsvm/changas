-- Audit fix: identity decisions never notified the provider (no row, no push,
-- no mail). Both approve and reject now enqueue a VERIFICATION notification
-- pointing at the onboarding review page, where rejections show the reason.

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

  perform public.enqueue_user_notification(
    target_provider_user_id,
    'VERIFICATION',
    case when normalized_decision = 'APPROVE' then 'Identidad verificada' else 'Identidad rechazada' end,
    case when normalized_decision = 'APPROVE'
      then 'Tu perfil de proveedor quedó habilitado. Ya podés publicar servicios.'
      else 'Tu identidad fue rechazada. Revisá el motivo y reenviala.' end,
    '/provider/onboarding/review',
    'IDENTITY_REVIEW_DECIDED',
    created_review_id,
    'provider_identity_review',
    created_review_id,
    true,
    true
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
