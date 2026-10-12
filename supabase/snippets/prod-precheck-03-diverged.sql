-- Probe 3/3: cuerpos en UNA línea (para diff exacto prod vs repo) de las 4
-- funciones divergentes que las migraciones reemplazan wholesale.
select 'list_conversation_proposals' as fn,
       replace(pg_get_functiondef(to_regprocedure('public.list_conversation_proposals(uuid)')), chr(10), '|') as def
union all
select 'list_job_scope_changes',
       replace(pg_get_functiondef(to_regprocedure('public.list_job_scope_changes(uuid)')), chr(10), '|')
union all
select 'respond_job_scope_change',
       replace(pg_get_functiondef(to_regprocedure('public.respond_job_scope_change(uuid,text)')), chr(10), '|')
union all
select 'start_service_conversation',
       replace(pg_get_functiondef(to_regprocedure('public.start_service_conversation(text,text)')), chr(10), '|')
order by 1;
