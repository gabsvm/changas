-- Cierre real del codigo de confirmacion por REST directa.
--
-- Por que existe esta migracion: 20261012000000 intento ocultar la columna
-- con `revoke select (confirmation_code) ...`, pero en Postgres el SELECT
-- a nivel tabla (`grant select on jobs to authenticated`) autoriza TODAS
-- las columnas: el revoke por columna no puede quitar lo que el grant de
-- tabla otorga (el chequeo es OR). Resultado: el prestador podia leer el
-- codigo por REST directa y saltear el mecanismo.
--
-- Fix: quitar el SELECT de tabla y otorgar por columna todo EXCEPTO
-- confirmation_code. Lectores directos actuales via REST (rol authenticated):
--   - borrado de cuenta: select id + filtros client/provider/status
--   - (pagos usa service_role, no afectado)
-- Los RPC SECURITY DEFINER (get_job_detail, transition_job_status, listados)
-- no dependen de estos grants y siguen iguales. RLS sigue aplicando.

revoke select on public.jobs from anon, authenticated;

grant select (
  id,
  conversation_id,
  service_id,
  client_user_id,
  provider_user_id,
  accepted_proposal_version_id,
  payment_attempt_id,
  status,
  confirmed_at,
  created_at,
  updated_at,
  current_schedule_version_id
) on public.jobs to authenticated;
