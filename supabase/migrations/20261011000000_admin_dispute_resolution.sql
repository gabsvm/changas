-- Audit fix: disputed jobs had no exit (no transition leaves DISPUTED and
-- the admin panel is read-only). Admins can now resolve a dispute to
-- COMPLETED or CANCELLED with a mandatory reason; both parties are told
-- in-thread unless the conversation is closed or blocked.

create or replace function public.admin_resolve_job_dispute(
  target_job_id uuid,
  requested_resolution text,
  requested_reason text
)
returns public.job_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  target_job public.jobs%rowtype;
  target_conversation public.conversations%rowtype;
  normalized_resolution public.job_status;
  normalized_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  event_time timestamptz := timezone('utc', now());
begin
  perform public.require_admin();

  if target_job_id is null then
    raise exception using errcode = '22023', message = 'job id is required';
  end if;

  if upper(btrim(coalesce(requested_resolution, ''))) = 'COMPLETED' then
    normalized_resolution := 'COMPLETED';
  elsif upper(btrim(coalesce(requested_resolution, ''))) = 'CANCELLED' then
    normalized_resolution := 'CANCELLED';
  else
    raise exception using errcode = '22023', message = 'dispute resolution must be COMPLETED or CANCELLED';
  end if;

  if normalized_reason is null or char_length(normalized_reason) < 2 then
    raise exception using errcode = '22023', message = 'dispute resolution reason is required';
  end if;

  select * into target_job from public.jobs where id = target_job_id for update;
  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'job not found';
  end if;
  if target_job.status <> 'DISPUTED' then
    raise exception using errcode = '55000', message = 'only disputed jobs can be resolved';
  end if;

  update public.jobs
  set status = normalized_resolution, updated_at = event_time
  where id = target_job_id;

  insert into public.job_events (
    job_id, actor_user_id, event_type, from_status, to_status, reason, created_at
  ) values (
    target_job_id,
    actor_user_id,
    'JOB_DISPUTE_RESOLVED',
    'DISPUTED',
    normalized_resolution,
    normalized_reason,
    event_time
  );

  insert into public.admin_audit_events (
    actor_user_id, action_type, target_type, target_id, metadata
  ) values (
    actor_user_id,
    'JOB_DISPUTE_RESOLVED',
    'JOB',
    target_job_id,
    jsonb_build_object('resolution', normalized_resolution::text, 'reason', normalized_reason)
  );

  select * into target_conversation
  from public.conversations
  where id = target_job.conversation_id;

  if target_conversation.id is not null
    and target_conversation.status = 'OPEN'
    and not exists (
      select 1 from public.user_blocks
      where conversation_id = target_job.conversation_id
    ) then
    insert into public.messages (conversation_id, sender_user_id, kind, body, created_at)
    values (
      target_job.conversation_id,
      null,
      'SYSTEM',
      case normalized_resolution
        when 'COMPLETED' then 'El equipo de Changas resolvió la disputa: el trabajo quedó completado.'
        else 'El equipo de Changas resolvió la disputa: el trabajo fue cancelado.'
      end,
      event_time
    );

    update public.conversations set last_message_at = event_time, updated_at = event_time
    where id = target_job.conversation_id;
  end if;

  return normalized_resolution;
end;
$$;

revoke all on function public.admin_resolve_job_dispute(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.admin_resolve_job_dispute(uuid, text, text)
to authenticated, service_role;
