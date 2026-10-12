-- Verify 20261013090000 en prod: función + cron activos.
select to_regprocedure('public.materialize_due_settlement_reminders(timestamptz)') is not null as reminder_fn,
       (select count(*) from cron.job where jobname = 'settlement-due-reminders') as cron_jobs;
