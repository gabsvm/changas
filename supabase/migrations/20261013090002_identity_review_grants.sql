-- La migración 20261011000006 revocó EXECUTE de las tres RPC de revisión de
-- identidad pero solo re-otorgó list_admin_identity_queue: get_admin_identity_case
-- y decide_provider_identity_review quedaron sin acceso para authenticated
-- (falla phase-09-identity-review #12). Restaura los grants sin tocar firmas.
grant execute on function public.get_admin_identity_case(uuid)
to authenticated, service_role;
grant execute on function public.decide_provider_identity_review(uuid, text, text)
to authenticated, service_role;
