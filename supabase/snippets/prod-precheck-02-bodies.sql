-- Probe 2/2: cuerpos completos de las 4 funciones más riesgosas
-- (reemplazo wholesale; prod tiene 58 migraciones fuera del repo).
-- Comparar cada cuerpo contra la definición vigente del repo antes de aplicar.
select pg_get_functiondef(to_regprocedure('public.transition_job_status(uuid,text,text,text,text)')) as transition_job_status,
       pg_get_functiondef('public.auto_complete_stale_jobs()'::regprocedure) as auto_complete_stale_jobs,
       pg_get_functiondef(to_regprocedure('public.start_service_conversation(uuid,text,text)')) as start_service_conversation,
       pg_get_functiondef(to_regprocedure('public.get_job_settlement_snapshot(uuid)')) as get_job_settlement_snapshot;
