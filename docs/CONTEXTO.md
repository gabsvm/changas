# Changas — Contexto de trabajo (2026-10-09)

Documento vivo: estado de producción, qué se hizo y qué falta. Para reanudar: leer este archivo + `## Reanudar`.

Repo: `gabsvm/changas` (main @ `d4f8b7f`). Stack: Next.js 16 + Tailwind v4 + Supabase (Postgres 17 + pg_cron + Vault).

## Producción (verificado 2026-10-09)

- Web: https://changas-web-gray.vercel.app — deploy prod `Ready`, `/health` → `revision: 84c3bc391e88`.
- Supabase: `krjbpcnjhckqgwlqliyq` (Changas, sa-east-1, ACTIVE_HEALTHY). Migraciones `20261011000000..07` aplicadas + repaired + objetos verificados (RPCs settlement, `job_settlement_attempts`, columnas `job_id`/`settlement_scope_change_ids`).
- OJO divergencia histórica: el remoto tiene 58 migraciones aplicadas que no existen en el repo (2026-10-02, de otro checkout). **NUNCA `supabase db push`**: cambios quirúrgicos con `db query --file` + `migration repair <versión> --status applied`.
- Env prod: `NEXT_PUBLIC_SITE_URL=https://changas-web-gray.vercel.app`, VAPID completo, `NOTIFICATION_DISPATCH_SECRET` + Vault seteados. **Falta `RESEND_*`** (email muerto a propósito; solo push).
- Gates en main: typecheck 0, lint 0, 390 tests verdes; prettier sin issues nuevos (12 pre-existentes en HEAD); pgTAP `phase-11-payment-reconciliation` 29→45 tests (corre en CI, no local: sin Docker).
- Cuentas admin prueban el flujo completo sin dinero (simulación de pagos scope + settlement solo `is_current_user_admin` en prod).

## Modelo de dinero vigente: hire-on-accept + cobro al cierre

Contratar = aceptar. El trabajo nace `CONFIRMED` sin pago (`20261010000000_hire_on_accept.sql`):

- `ACCEPT` → propuesta `ACCEPTED` + job `CONFIRMED`. Reserva directa igual. `payment_attempt_id` nullable.
- Adicionales de scope-change: se pagan al aprobar (o los simula un admin).
- **Cobro al cierre** (`20261011000007_job_settlement.sql`, en prod): al completar, el cliente genera un checkout Checkout Pro por base + adicionales aprobados impagos (`createJobSettlementCheckout`). Solo `COMPLETED` liquida; `DISPUTED`/`CANCELLED`/`NO_SHOW` nunca; idempotente + índice único anti-doble-cobro; extras incluidos pasan a `PAID`, propuesta a `PAID`.
- Auto-confirmación a 7 días (cron `jobs-auto-complete` diario 04:00) — solo cambia estado, el cliente paga después desde `/jobs/[id]`.
- Fase 2 (no hecha): tokenización/auto-charge (card guardada al contratar, cargo automático al completar). Requiere validar Split 1:1 + card storage con cuentas test de MP.

## Hecho (sesiones 2026-10-07/09)

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

## Pendiente (orden sugerido)

1. **Email (Resend):** pasar `RESEND_API_KEY`/`RESEND_FROM_EMAIL`; 3+ avisos EMAIL trabados históricos.
2. **E2E Playwright** de flujos core (contratar → scope-change → completar → pagar), necesita staging con backend.
3. **Fase 2 cobro:** tokenización/auto-charge si se valida con MP (ver arriba).
4. **Contenido:** publicar el primer servicio real (todo sigue en borrador/ejemplos).
5. **Restos conocidos (no bloquear):** paneles provider-dashboard con `bg-white` literales; footer sobrio por decisión; `AGENTS.md`/`CLAUDE.md` autogenerados (untracked, no commitear); `redesign/` untracked ajeno; prettier `format:check` falla en 12 archivos desde HEAD; pgTAP sin Docker local (solo CI).

## Reanudar (próxima sesión)

- `git pull` en main (último: `d4f8b7f`). Worktree limpio salvo los 3 untracked ajenos.
- Riesgos abiertos: RPC reales en prod podrían diferir de los auditados (divergencia 58 migraciones); sin reproducción runtime de varios fixes (solo estático + tests); `.env.local` con secretos reales nunca leído.
- Flujo de prueba completo (admin, sin dinero): contratar desde publicación → chatear → aceptar propuesta (contrata) → scope-change con repuesto (simular pago) → provider marca completo → cliente confirma → cliente paga cierre (simular pago) o deja pendiente.
- Dónde está cada cosa: settlement `supabase/migrations/20261011000007_job_settlement.sql` + `apps/web/src/lib/payments/server.ts` (`createJobSettlementCheckout`) + `apps/web/src/app/(account)/jobs/[jobId]/page.tsx` (sección "Pago del trabajo") + `applyFakeSettlementPayment` en `apps/web/src/lib/jobs/server.ts`.

## Comandos

```powershell
pnpm --filter @changas/web typecheck; pnpm --filter @changas/web lint; pnpm test
supabase db query --linked --project-ref krjbpcnjhckqgwlqliyq --file <migración>
supabase migration repair <versión> --status applied --linked --project-ref krjbpcnjhckqgwlqliyq
supabase migration list --linked --project-ref krjbpcnjhckqgwlqliyq
vercel --prod --yes
```
