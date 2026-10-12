# Changas — Contexto de trabajo (2026-10-11)

Documento vivo: estado de producción, qué se hizo y qué falta. Para reanudar: leer este archivo + `## Reanudar`.

Repo: `gabsvm/changas` (main @ serie `04a36b9..4d590c5` + fix `04`). Stack: Next.js 16 + Tailwind v4 + Supabase (Postgres 17 + pg_cron + Vault).

## Producción (verificado 2026-10-11)

- Web: https://changas-web-gray.vercel.app — deploy prod `Ready` del SHA `4d590c5`.
- Supabase: `krjbpcnjhckqgwlqliyq` (Changas, sa-east-1, ACTIVE_HEALTHY). Migraciones `20261012000000..04` + serie `20261013080000..20261013090002` (2026-10-12) aplicadas con `db query --file` + `repair`, verificadas objeto por objeto en prod: columnas `completion_requested_at`/`response_reason`×2, overloads 2+3 args en `respond_to_proposal`/`respond_job_scope_change`, tabla `job_confirmation_code_attempts`, `ambiguity_fixed=true` en snapshot, `reminder_fn=true` + cron `settlement-due-reminders` (6h), `pair_block_guard=true`, `identity_entrypoints_ok=true`. Precheck md5 prod-vs-repo en 9 funciones reemplazadas: 5 idénticas, 4 solo whitespace (reemplazo seguro); `get_admin_identity_case`/`list_admin_identity_queue` divergen pero solo recibieron grants.
- Fix P0-01 (auditoría 2): el `REVOKE SELECT (confirmation_code)` de la migración 00 era inefectivo (el `GRANT SELECT` a nivel tabla autoriza todo). Migración `20261012000004`: revoke de tabla + grant por columna de todo excepto el código. Verificado: código oculto + controles positivos (`id`, `status`, `client/provider_user_id`, `service_role`) intactos. Rollback: `grant select on public.jobs to authenticated`.
- OJO divergencia histórica: el remoto tiene 58 migraciones aplicadas que no existen en el repo. **NUNCA `supabase db push`**: cambios quirúrgicos con `db query --file` + `migration repair <versión> --status applied`. OJO CLI: `db query` solo muestra el ÚLTIMO result set (unificar checks en un SELECT) y no acepta `--query` (usar `--file`).
- Env prod: `NEXT_PUBLIC_SITE_URL=https://changas-web-gray.vercel.app`, VAPID completo, `NOTIFICATION_DISPATCH_SECRET` + Vault seteados. **Falta `RESEND_*`** (email muerto a propósito; solo push).
- Gates en main: typecheck 0, lint 0, 403 tests verdes; prettier sin issues nuevos (12 pre-existentes en HEAD); pgTAP corre en CI, no local (sin Docker).
- **CI ROJO (P1-01 auditoría 2):** job `validate` falla en `pnpm audit --prod --audit-level high` (8 vulns: next SSRF GHSA-cjq9-62q9-8jv4, sharp, source-map-js); `supabase-integration` queda skipped. Vercel publica igual (sin gate de CI).
- Cuentas admin prueban el flujo completo sin dinero (simulación de pagos scope + settlement solo `is_current_user_admin` en prod).

## Modelo de dinero vigente: hire-on-accept + cobro al cierre

Contratar = aceptar. El trabajo nace `CONFIRMED` sin pago (`20261010000000_hire_on_accept.sql`):

- `ACCEPT` → propuesta `ACCEPTED` + job `CONFIRMED`. Reserva directa igual. `payment_attempt_id` nullable.
- Adicionales de scope-change: se pagan al aprobar (o los simula un admin).
- **Cobro al cierre** (`20261011000007_job_settlement.sql`, en prod): al completar, el cliente genera un checkout Checkout Pro por base + adicionales aprobados impagos (`createJobSettlementCheckout`). Solo `COMPLETED` liquida; `DISPUTED`/`CANCELLED`/`NO_SHOW` nunca; idempotente + índice único anti-doble-cobro; extras incluidos pasan a `PAID`, propuesta a `PAID`.
- Auto-confirmación a 7 días (cron `jobs-auto-complete` diario 04:00) — solo cambia estado, el cliente paga después desde `/jobs/[id]`.
- Fase 2 (no hecha): tokenización/auto-charge (card guardada al contratar, cargo automático al completar). Requiere validar Split 1:1 + card storage con cuentas test de MP.

## Hecho (sesiones 2026-10-07/11)

1. **Búsqueda:** "publicado que no aparece" = servicio en borrador; RLS owner-only, visibilidad solo vía RPC definer.
2. **Auditoría UX + roadmap P0–P2:** manifest instalable, foco visible, contraste AA, retry, covers por portfolio, precio con desglose, verificación honesta, SW selectivo, tabs Trabajos, badge real, append sin perder scroll, priming push, OG images, dark mode.
3. **Dark:** clase `.dark` + `@custom-variant` + ThemeSelector (default Claro, sin FOUC). NUNCA reintroducir la media query.
4. **Tema:** Space Grotesk + Inter, TTFs vendored en `public/fonts` para OG.
5. **Sistema ilustrado:** `IllustratedBadge`, tiles por rubro, ServiceCards, estándar landing en toda la app.
6. **Push real:** VAPID + `web-push`, payload cifrado, click funcional, cron 5min, e2e en dispositivo real, stale-subscription recovery.
7. **Auditoría 33 bugs:** DNI en Storage, adjuntos fantasma, rate-limit, anti-replay, failEvent, idempotencia signup, schedule BEFORE, batch inbox, manifest/alt/robots/sitemap (`20261008000000`).
8. **Docs:** borrados 20 planes + 2 specs + 11 reports + baselines; 13 previews archivados; README/master-plan/brand/runbook actualizados.
9. **Bypass admin scope-change** (`216b39f`): `applyFakeAdditionalPayment` solo admin + UI "simular pago".
10. **Fixes auditoría de flujos P0+P1** (desplegado `800aceb`): scope $0 sin crash, `formatMinorUnits(0)`, REJECTED reenvío + motivo, guards `user_blocks` en propuestas, PAID aplica precio/alcance, DISPUTED con resolución admin, historial jobs, proposal-card honesta + "Ver trabajo", banner jobs en chat, paginación acumuladora, consultError, toggle email honesto, notificación identidad, fix `?user` 500, confirm catálogo, webhook REFUNDED por observación, refresh-on-401 token seller, borrado baneo-primero.
11. **Cobro al cierre** (desplegado `800aceb`, diseño A aprobado): settlement checkout + total consolidado, UI "Pagar con Mercado Pago" + sim admin, pgTAP 29→45.
12. **Fix SQL deploy** (`84c3bc3`): sintaxis `RETURNS TABLE` válida en 03/04/07 (falló el primer apply, se corrigió y aplicó).
13. **6 commits features** (`04a36b9..4d590c5`, desplegado): Seguimiento + código de confirmación, solicitudes de habilidades provider→admin, retorno post-pago al trabajo, recordatorio 24h + nudge de reseña, polish UI, CONTEXTO.
14. **Deploy SQL + fix P0-01** (2026-10-11): verificado 00–03 activos en prod; revoke por columna inefectivo → migración 04 (allowlist por columna) aplicada + repaired + verificada con controles negativo/positivo.
15. **Segunda auditoría recibida** (2026-10-11, sobre `4d590c5`): confirma P0-01 (ya fixeado), P1-08 despejado por verificación directa; nuevo bloqueador P1-01 (CI rojo por advisories). P2-01 parcialmente inexacto (settlement sí manda `?job=`).

## Pendiente (orden sugerido)

1. **CI verde (P1-01):** update Next.js + deps compatibles, regenerar `pnpm-lock.yaml`, audit + gates + CI+Supabase verdes. Evaluar protección de `main` y gate Vercel.
2. **Auditoría 2, resto:** P0-02 idempotencia checkout antes de dinero real; P1-07 anti-brute-force código; P1-02 flag `PAYMENTS_ENABLED`; P1-06 copy failure neutral; P2-02 `reviewer_note` visible; P2-03 índice único skill requests; P1-03 SW; P1-04 total settled; P1-05 redirect `/jobs`; P2-04/05 paginación+unread; P2-06/07/08.
3. **Email (Resend):** pasar `RESEND_API_KEY`/`RESEND_FROM_EMAIL`; 3+ avisos EMAIL trabados históricos.
4. **E2E Playwright** de flujos core (contratar → scope-change → completar → pagar), necesita staging con backend.
5. **Fase 2 cobro:** tokenización/auto-charge si se valida con MP (ver arriba).
6. **Contenido:** publicar el primer servicio real (todo sigue en borrador/ejemplos).
7. **Restos conocidos (no bloquear):** paneles provider-dashboard con `bg-white` literales; footer sobrio por decisión; `AGENTS.md`/`CLAUDE.md` autogenerados (untracked, no commitear); `redesign/` untracked ajeno; prettier `format:check` falla en 12 archivos desde HEAD; pgTAP sin Docker local (solo CI).

## Reanudar (próxima sesión)

- `git pull` en main (último: serie `04a36b9..4d590c5` + fix `04`, pusheado).
- Riesgos abiertos: código de 4 dígitos sin throttle (P1-07); CI rojo (P1-01) con Vercel sin gate; RPC reales en prod podrían diferir de los auditados (divergencia 58 migraciones); sin reproducción runtime de varios fixes (solo estático + tests); `.env.local` con secretos reales nunca leído.
- Flujo de prueba completo (admin, sin dinero): contratar desde publicación → chatear → aceptar propuesta (contrata) → scope-change con repuesto (simular pago) → provider marca completo → cliente confirma (con código) → cliente paga cierre (simular pago) o deja pendiente.
- Dónde está cada cosa: settlement `supabase/migrations/20261011000007_job_settlement.sql` + `apps/web/src/lib/payments/server.ts` (`createJobSettlementCheckout`) + `apps/web/src/app/(account)/jobs/[jobId]/page.tsx` (sección "Pago del trabajo") + `applyFakeSettlementPayment` en `apps/web/src/lib/jobs/server.ts`; código confirmación `20261012000000` + `20261012000004` (grants) + `job-tracking.ts`.

## Comandos

```powershell
pnpm --filter @changas/web typecheck; pnpm --filter @changas/web lint; pnpm test
supabase db query --linked --project-ref krjbpcnjhckqgwlqliyq --file <migración>
supabase migration repair <versión> --status applied --linked --project-ref krjbpcnjhckqgwlqliyq
supabase migration list --linked --project-ref krjbpcnjhckqgwlqliyq
vercel --prod --yes
```
