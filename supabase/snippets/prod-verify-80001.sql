-- Verify 20261013080001 en prod: el cuerpo debe referenciar la columna calificada.
select pg_get_functiondef(to_regprocedure('public.get_job_settlement_snapshot(uuid)'))
  like '%job_scope_changes.job_id%' as ambiguity_fixed;
