-- Audit fix: after accepting a proposal the chat showed "Aceptada" with no
-- link to the job, and the conversation had no path to /jobs at all. This
-- read model maps a conversation to its jobs (with the accepted version each
-- job was hired from) so the UI can link proposal cards and threads to work.

create or replace function public.list_conversation_jobs(
  target_conversation_id uuid
)
returns table (
  job_id uuid,
  accepted_proposal_version_id uuid,
  job_status public.job_status
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

  if not exists (
    select 1 from public.conversations c
    where c.id = target_conversation_id
      and caller_id in (c.client_user_id, c.provider_user_id)
  ) then
    raise exception using errcode = '42501', message = 'conversation access denied';
  end if;

  return query
  select j.id, j.accepted_proposal_version_id, j.status
  from public.jobs j
  where j.conversation_id = target_conversation_id
  order by j.created_at desc, j.id desc;
end;
$$;

revoke all on function public.list_conversation_jobs(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_conversation_jobs(uuid)
to authenticated, service_role;
