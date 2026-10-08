# Changas — Contexto de trabajo (2026-10-08)

Documento vivo: qué se hizo, en qué estado está producción y qué falta.
Repo: `gabsvm/changas` (main). Stack: Next.js 16 + Tailwind v4 + Supabase (Postgres 17 + pg_cron + Vault).

## Producción

- Web: https://changas-web-gray.vercel.app (proyecto `changas-web`, deploy por push a main o `vercel --prod`)
- Supabase: `krjbpcnjhckqgwlqliyq` (Changas, sa-east-1, ACTIVE_HEALTHY)
- OJO divergencia histórica: el remoto tiene 58 migraciones aplicadas que no existen en el repo (2026-10-02, de otro checkout). **NUNCA `supabase db push`**: se aplican cambios quirúrgicos con `db query --file` + `migration repair <version> --status applied`.
- Env prod: `NEXT_PUBLIC_SITE_URL=https://changas-web-gray.vercel.app`, VAPID completo, `NOTIFICATION_DISPATCH_SECRET` + Vault `notification_dispatch_{url,secret}` seteados. **Falta `RESEND_*`** (email muerto a propósito; solo push).
- Datos: 3 providers ACTIVE, 1 servicio en **borrador** (`is_published=false`), 1 job, 0 suscripciones push iniciales.

## Modelo de dinero vigente: hire-on-accept

Contratar = aceptar. El trabajo nace `CONFIRMED` sin pago (`20261010000000_hire_on_accept.sql`):
- `ACCEPT` → propuesta `ACCEPTED` + job `CONFIRMED` (antes: `AWAITING_PAYMENT` → pago → job).
- Reserva directa (`DIRECT_BOOKING`) también crea el job al crearla.
- `payment_attempt_id` nullable. Botones "Pagar y contratar" eliminados; acciones `startProposalCheckoutAction` / `startScopeChangeCheckoutAction` guardadas para el cobro al cierre.
- Cierre: sin reclamo se liquida, con reclamo (`DISPUTED`) no se cobra, fantasma → auto-confirmación a 7 días (cron `jobs-auto-complete` diario 04:00).
- Pendiente: cobro real al cierre (ver abajo).

## Hecho (sesiones 2026-10-07/08)

1. **Búsqueda:** "publicado que no aparece" = servicio en borrador (`is_published=false`); RLS `services` owner-only, visibilidad solo vía RPC definer.
2. **Auditoría UX + roadmap P0–P2:** manifest instalable (PNG/maskable/screenshots/shortcuts), foco visible, contraste AA, retry en errores, covers por portfolio (RPC v4 `cover_image_url`), precio con desglose + garantía, verificación honesta, SW selectivo, tabs Trabajos, badge real, append sin perder scroll, priming push, OG images, dark mode.
3. **Dark:** clase `.dark` + `@custom-variant` + ThemeSelector (Claro/Oscuro/Sistema, default Claro, pre-paint sin FOUC). NUNCA reintroducir la media query.
4. **Tema:** Space Grotesk (display) + Inter (body), TTFs vendored en `public/fonts` para OG.
5. **Sistema ilustrado:** `IllustratedBadge` (7 tonos), tiles por rubro con gradiente, canvas con grano, ServiceCards en home, UI elevada al estándar landing en toda la app.
6. **Push real:** VAPID + `web-push`, payload cifrado con título/cuerpo, click funcional, mensajes pushean, cron cada 5min, e2e probado en dispositivo real. Stale-subscription recovery incluido.
7. **Auditoría 33 bugs:** críticos (DNI en Storage, adjuntos fantasma), rate-limit, anti-replay, failEvent, idempotencia signup, schedule BEFORE, batch inbox, manifest/alt/robots/sitemap. Migración `20261008000000_audit_fixes.sql` aplicada.
8. **Docs:** borrados 20 planes + 2 specs + 11 reports + baselines; archivados 13 previews HTML en `docs/design/archive/`; README/master-plan/brand-system/runbook actualizados.

## Pendiente (orden sugerido)

1. **Cobro al cierre con MP** (diseño acordado): tokenización (card_token → customer con tarjeta guardada → cargo al completar; sin reclamo no hay cargo). Requiere: UI guardar tarjeta al contratar, cargo en `COMPLETED`/auto-confirm, wiring con `startProposalCheckoutAction`. Ver `docs/decisions/payment-provider.md` + spec payments.
2. **Email (Resend):** pasar `RESEND_API_KEY`/`RESEND_FROM_EMAIL`; hay 3+ avisos EMAIL trabados históricos.
3. **E2E Playwright** de flujos core (necesita entorno staging con backend).
4. **Restos conocidos:** paneles provider-dashboard con `bg-white` literales fuera del alcance priorizado; footer sobrio por decisión; `AGENTS.md`/`CLAUDE.md` autogenerados por Next (untracked, no commitear).
5. **Contenido:** publicar el primer servicio real (sigue todo en borrador/ejemplos).

## Comandos

```powershell
pnpm --filter @changas/web typecheck; pnpm --filter @changas/web lint; pnpm test
supabase db query --linked --project-ref krjbpcnjhckqgwlqliyq --file <migración>
supabase migration repair <versión> --status applied --linked --project-ref krjbpcnjhckqgwlqliyq
vercel --prod --yes
```
