-- Activa el recordatorio 24h: la función existe desde Phase 08 pero nada la
-- llamaba en producción. Se materializa cada 30 minutos; el dispatch
-- existente (cada 5 min) los envía.
select cron.schedule(
  'job-reminders-24h',
  '*/30 * * * *',
  'select public.materialize_due_job_reminders()'
);
