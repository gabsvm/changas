-- Probe 1/2: overloads y firmas en prod de cada función que las migraciones
-- 20261013080000..20261013090002 reemplazan. Comparar contra el repo antes de aplicar.
select p.proname as fn,
       pg_get_function_identity_arguments(p.oid) as args,
       md5(pg_get_functiondef(p.oid)) as def_md5
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'transition_job_status',
    'auto_complete_stale_jobs',
    'respond_to_proposal',
    'respond_job_scope_change',
    'list_conversation_proposals',
    'list_job_scope_changes',
    'get_job_detail',
    'get_job_settlement_snapshot',
    'start_service_conversation',
    'materialize_due_settlement_reminders',
    'decide_provider_identity_review',
    'get_admin_identity_case',
    'list_admin_identity_queue'
  )
order by 1, 2;
