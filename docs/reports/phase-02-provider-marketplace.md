# Phase 02 — Provider marketplace audit hardening

## Estado y alcance

La rama de trabajo es `codex/phase-02-provider-marketplace`, publicada en
`origin/codex/phase-02-provider-marketplace`. El trabajo permanece limitado a
provider marketplace: catálogo de skills, perfiles públicos, provider skills,
servicios, tags, precios, experiencia, educación, certificaciones, portfolio,
áreas y disponibilidad descriptiva.

No se inició Phase 03 ni se implementaron categories adicionales, search,
ranking, chat, jobs, booking, payments, reviews, notificaciones, AI o admin.
No se usaron documentos de identidad reales.

## Commits

La cadena completa de Phase 02 conserva el base aprobado y agrega el
hardening auditado:

- `fefc28b` — `feat(marketplace): add provider marketplace contracts`
- `0d246e9` — `feat(marketplace): implement provider marketplace phase`
- `78bae56` — `ci(supabase): exclude out-of-scope edge runtime`
- `1753b1f` — `test(marketplace): preserve phase one RLS regression`
- `222997c`, `fd1cf00`, `4f18dbf`, `1977ac9` — ajustes de assertions y fixtures
- `baa7569` — `docs(runtime): align phase two setup guidance`
- `0cd5382` — `docs(marketplace): record phase two validation`
- `44703c2` — `fix(phase02): harden provider marketplace audit findings`
- `b7c768a`, `53da5b0`, `599a441` — correcciones de assertions y fixtures pgTAP
- `68da2a5` — `fix(phase02): use Supabase auth role in tag RPC`
- `a428987` — `fix(phase02): identify authenticated tag owners by uid`
- `d189f93` — `fix(phase02): align public route dynamic segments`

El HEAD funcional auditado es `d189f93`, descendiente directo del base
aprobado. No se hizo merge.

## Migración y modelo de datos

La migración original publicada no fue reescrita. La nueva migración fue
generada con:

`pnpm dlx supabase@2.116.0 migration new phase_02_audit_hardening`

y es:

`supabase/migrations/20260831014107_phase_02_audit_hardening.sql`

La migración agrega:

- Conversión única de precios existentes a minor units y constraints de rango
  seguro y moneda `ARS`.
- FK compuesta `services(provider_user_id, skill_id)` hacia
  `provider_skills(provider_user_id, skill_id)` con `ON DELETE RESTRICT`.
- Checks DB-level que exigen que `certifications.evidence_path` y
  `portfolio_items.media_path`, cuando existen, empiecen por el UUID del
  `provider_user_id` de la fila.
- Reemplazo seguro de `is_public_portfolio_media(text)`: prueba el path exacto,
  ownership de carpeta, item público, provider `ACTIVE` y no pausado.
- Proyecciones públicas sin `verification_badge`, y
  `public_service_tags(provider_slug, service_public_slug, tag)`.
- RPC `replace_service_tags(uuid, text[])`, con máximo ocho tags, normalización
  de espacios/case, rechazo de duplicados y autorización owner por
  `auth.uid()`; `service_role` queda permitido sólo para operaciones server-side.

## Grants y RLS

`supabase/config.toml` fija `auto_expose_new_tables = false`. Los grants de las
tablas privadas de Phase 02 se revocan primero para `public`, `anon` y
`authenticated`; luego se otorga a `authenticated` sólo el acceso Data API que
RLS restringe al owner (`SELECT, INSERT, UPDATE, DELETE`) y a `service_role`
los mismos privilegios explícitos para administración server-side. No hay
grants `anon` sobre tablas privadas.

La excepción de tags queda más restrictiva: `authenticated` conserva sólo
`SELECT` directo sobre `service_tags` y ejecuta `replace_service_tags`; no tiene
`INSERT`, `UPDATE` ni `DELETE` directo. El RPC tiene `EXECUTE` para
`authenticated` y `service_role`, no para `anon`. Las vistas
`public_provider_profiles` y `public_service_tags` tienen `SELECT` explícito
para `anon`, `authenticated` y `service_role`.

Los tests comprueban grants presentes y ausentes, RLS owner-only, aislamiento
entre usuarios, FK restrictiva, invariantes de path y que un provider no puede
auto-promoverse a `ACTIVE`.

## Proyecciones, rutas y tags

Las páginas públicas sólo leen proyecciones filtradas por provider `ACTIVE`, no
pausado, servicio publicado/no pausado y tags del mismo provider y
`service_public_slug`. Dos providers con el mismo service slug tienen tags
aislados en el regression test A/B.

La ruta de portfolio sólo descarga después de encontrar el `media_path` exacto
en `public_provider_portfolio`; si falta la fila responde 404 sin descarga ni
cache público. Sólo una media pública recibe `Cache-Control` público. El
endpoint usa el cliente admin únicamente en servidor, después de esa prueba.

La ruta de servicio se normalizó a `/p/[slug]/[serviceSlug]` para evitar el
conflicto de Next entre `[slug]` y `[providerSlug]`; la URL externa no cambió.
La ruta de management sigue protegida por Proxy/auth.

## Money y UI

`price_amount` representa minor units enteras; el único `currency_code` válido
es `ARS`. `packages/domain/src/money.ts` centraliza parseo, validación,
conversión y formato; acciones, páginas públicas, formularios y seeds usan
esas funciones. No se usa float como fuente de verdad. La UI acepta importes
mayores con hasta dos decimales según el helper, almacena centavos y muestra
formato ARS. Sólo se pueden elegir skills del provider seleccionado y quitar
una skill con servicios asociados devuelve un mensaje en español.

Se eliminó el badge de verificación ficticio y cualquier claim de verificación
de Phase 09. La UI muestra únicamente `Perfil activo`.

## Storage y evidencia runtime

Los buckets permanecen separados: `identity-documents` y
`provider-certification-evidence` son privados; `provider-portfolio` no es
público por defecto y sólo permite lectura pública si la función DB verifica la
media publicada. Los fixtures son sintéticos mínimos.

El script
`apps/web/scripts/supabase-runtime-security.mjs` crea dos usuarios, verifica
lectura/escritura propia, aislamiento de datos privados, rechazo de
self-activation, tags normalizados, precios ARS en minor units, rechazo de
metadata de certificación/portfolio con carpeta ajena y Storage: owner lee su
evidencia; usuario B y anónimo no; el portfolio público sólo se expone con la
regla pública; `identity-documents` sigue bloqueado para B/anónimo.

El job remoto también ejecuta reset desde cero, reset con seed sintético,
pgTAP y smoke browser en desktop y viewport móvil Pixel 5 sobre:
`/provider/manage`, `/p/demo-proveedor` y
`/p/demo-proveedor/demo-revision-pc`. No se agregó una app nativa.

## Causas de fallos CI y correcciones

- Run `33333073276`: `supabase start` falló porque el health check del Edge
  Runtime fuera de scope devolvió HTTP 503. Se consultó `supabase start --help`
  y se usó `--exclude edge-runtime`.
- Run `33349864926`: el runtime reveló que el RPC de tags no reconocía
  correctamente el usuario autenticado dentro de `SECURITY DEFINER`. Se
  corrigió la autorización para usar `auth.uid()` y mantener `service_role`
  explícito, sin ampliar permisos.
- Run `33350135080`: Next no arrancó por los nombres dinámicos distintos
  `[providerSlug]` y `[slug]` en el mismo nivel. Se unificó el segmento a
  `[slug]` manteniendo la URL.

## Validation gates

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| Install frozen | PASS | `pnpm install --frozen-lockfile` local |
| Lint | PASS | `pnpm lint` local y job `validate` |
| Typecheck | PASS | `pnpm typecheck` local y job `validate` |
| Unit tests | PASS | `pnpm test`: 9 files, 22 tests |
| Production build | PASS | `pnpm build`; rutas públicas, management y portfolio compiladas |
| Format check | PASS | `pnpm format:check` local y job `validate` |
| `git diff --check` | PASS | ejecución local |
| Supabase migration/reset local | NOT RUN | Docker no está instalado en este checkout Windows |
| pgTAP local | NOT RUN | requiere Docker/Postgres local |
| Supabase migration/reset remoto | PASS | run `33350494409`, `ubuntu-latest`, clean reset y seeded reset |
| pgTAP remoto | PASS | run `33350494409`: 24 audit tests, además de suites Phase 01/02 |
| Runtime RLS/Auth/Storage remoto | PASS | run `33350494409`: script client/Storage completado |
| Browser smoke remoto | PASS | run `33350494409`: desktop y Pixel 5 |
| GitHub Actions remoto | PASS | [run 33350494409](https://github.com/gabsvm/changas/actions/runs/33350494409), ambos jobs PASS sobre `d189f93` |

El CI no usa credenciales Supabase Cloud: levanta el stack local del runner,
exporta sus credenciales efímeras y limpia fixtures al finalizar. GitHub aún
muestra una annotation informativa porque algunas actions internas apuntan a
Node 20, pero el proyecto y sus jobs usan Node `24.20.0`; no se declara
compatibilidad Node 20.

## Node.js y límites

El proyecto usa Node 24 en `package.json` engines, `.nvmrc`, GitHub Actions y
documentación. `@types/node` está alineado a la major 24 y el lockfile conserva
versiones pinned.

La validación runtime local y QA manual de dispositivo quedan `NOT RUN` por la
ausencia de Docker/cliente nativo en este checkout; la validación reproducible
remota sí está PASS. La rama se deja publicada y el trabajo se detiene aquí.
No se inicia Phase 03.
