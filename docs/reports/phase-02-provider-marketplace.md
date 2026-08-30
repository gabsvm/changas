# Phase 02 — Provider marketplace

## Estado y alcance

La implementación de Phase 02 está aislada en `codex/phase-02-provider-marketplace`, creada desde el HEAD aprobado de Phase 01 `7ffa8b1b10b8226c7a7ad49cb4255513240a6679`. El HEAD funcional documentado es `baa7569` (`docs(runtime): align phase two setup guidance`), con la rama publicada en `origin/codex/phase-02-provider-marketplace`.

Se implementaron únicamente los datos y superficies de marketplace de provider: categorías, skills, sinónimos, provider skills, servicios, precios, modalidades, ofertas, experiencia, educación, certificaciones, portfolio, áreas de servicio, disponibilidad descriptiva y pausas de provider/servicio. No se inició Phase 03.

No se implementaron discovery/search, ranking, homepage de resultados, AI, chat, propuestas, jobs, booking, pagos, reviews, notificaciones, admin dashboard ni features de fases posteriores. No se crearon reseñas, trabajos, pagos ni datos personales reales.

## Commits de Phase 02

- `fefc28b` — `feat(marketplace): add provider marketplace contracts`
- `0d246e9` — `feat(marketplace): implement provider marketplace phase`
- `78bae56` — `ci(supabase): exclude out-of-scope edge runtime`
- `1753b1f` — `test(marketplace): preserve phase one RLS regression`
- `222997c` — `test(supabase): align phase two fixture assertions`
- `fd1cf00` — `test(supabase): normalize fixture slugs`
- `4f18dbf` — `test(supabase): include valid certification evidence metadata`
- `1977ac9` — `test(marketplace): target per-unit constraint assertion`
- `baa7569` — `docs(runtime): align phase two setup guidance`

El HEAD aprobado es ancestro directo de la rama (`git merge-base --is-ancestor` PASS). No se hizo merge ni se inició Phase 03.

## Schema y migración

La migración fue generada con `pnpm dlx supabase@2.116.0 migration new provider_marketplace`, sin reescribir migraciones publicadas:

- `supabase/migrations/20260830194611_provider_marketplace.sql`

Agrega:

- Catálogo controlado: `categories`, `skills`, `skill_synonyms`.
- Datos propios del provider: `provider_skills`, `services`, `service_tags`, `experiences`, `education`, `certifications`, `portfolio_items`, `service_areas`, `availability_rules` y `availability_blocks`.
- Enums `service_modality`, `price_model` y `schedule_type`.
- Campos de marketplace en `provider_profiles`: `public_slug`, `public_headline`, `marketplace_paused` y `availability_paused`.
- Checks para importes positivos en minor units, `QUOTE` sin importe, `PER_UNIT` con unidad, slugs, textos acotados, fechas/rangos y metadatos completos de evidencia/media.
- `service_areas.center` como `extensions.geography(Point, 4326)`, con índice GiST. El centro exacto no aparece en las proyecciones públicas; sólo se expone etiqueta aproximada y radio.
- Índices por provider/skill/publicación/orden, índices temporales y el índice GiST del área.
- Triggers para `updated_at`, slugs, protección de status del provider y protección de publicación del servicio.

La disponibilidad es metadata de agenda: no reserva turnos ni implementa booking.

## RLS, grants y autoridad

Todas las tablas nuevas tienen RLS habilitado. Las tablas propias del provider usan políticas owner-only para `authenticated`; la identidad de la fila se compara contra `auth.uid()` y los tests comprueban aislamiento entre dos usuarios.

La migración revoca privilegios implícitos y deja esta matriz explícita:

| Recurso                                                                                                                                                                                                                                                             | `anon`   | `authenticated`                                               | `service_role`                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `categories`, `skills`, `skill_synonyms`                                                                                                                                                                                                                            | `SELECT` | `SELECT`                                                      | `SELECT, INSERT, UPDATE, DELETE`                                         |
| `provider_skills`, `services`, `service_tags`, `experiences`, `education`, `certifications`, `portfolio_items`, `service_areas`, `availability_rules`, `availability_blocks`                                                                                        | ninguno  | `SELECT, INSERT, UPDATE, DELETE`, limitado por RLS owner-only | `SELECT, INSERT, UPDATE, DELETE` explícitos; bypass RLS sólo server-side |
| `public_provider_profiles`, `public_provider_skills`, `public_provider_services`, `public_service_tags`, `public_provider_experiences`, `public_provider_education`, `public_provider_certifications`, `public_provider_portfolio`, `public_provider_service_areas` | `SELECT` | `SELECT`                                                      | `SELECT`                                                                 |

`USAGE` de `public` se concede explícitamente a `anon`, `authenticated` y `service_role`; se revocan los privilegios de `public` en tablas y vistas antes de las concesiones anteriores. No se otorga acceso `anon` a tablas privadas.

El status del provider no se puede modificar desde las acciones normales: el trigger rechaza transiciones no autorizadas y la policy conserva la restricción de Phase 01. `private.activate_provider_for_test(uuid)` es `SECURITY DEFINER`, valida el target y sólo tiene `EXECUTE` para `service_role`; es una ruta temporal de fixtures/admin hasta Phase 09 y no se expone al cliente.

La configuración local contiene `auto_expose_new_tables = false`, por lo que los tests dependen de los grants explícitos y no de defaults.

## Proyecciones públicas

Las páginas públicas leen únicamente las vistas `public_*`, filtradas a provider `ACTIVE`, provider no pausado y, en servicios, servicio publicado/no pausado. Incluyen display name, avatar, zona aproximada, bio, headline, skills publicadas, servicios, experiencia/educación/certificaciones marcadas públicas, portfolio marcado público y el badge controlado de verificación de fixture.

Las vistas no seleccionan `profile_private`, DNI, documentos de identidad, teléfono/email privados, fecha de nacimiento, dirección exacta, coordenadas exactas, paths de evidencia de certificación ni portfolio privado. El portfolio público usa un bucket separado y sólo muestra media asociada a un item público.

La UI de provider está en `/provider/manage`; las páginas anónimas son `/p/[slug]` y `/p/[providerSlug]/[serviceSlug]`. La UI no agrega búsqueda, ranking ni resultados de discovery.

## Storage

Se mantienen separados los buckets:

- `identity-documents`: privado y sin cambios de Phase 01.
- `provider-certification-evidence`: privado, JPEG/PNG/PDF, límite 10 MiB, acceso por carpeta al owner autenticado.
- `provider-portfolio`: bucket no público por defecto, JPEG/PNG/WebP, límite 5 MiB; el owner puede administrar objetos y la lectura anónima sólo pasa por la policy que verifica item público + provider activo/no pausado.

El runtime usa fixtures sintéticos mínimos y verifica: owner sube/lee evidencia, usuario B y anónimo no la leen; owner sube portfolio público y anónimo puede leer únicamente ese media; el bucket de identidad sigue bloqueado para B/anónimo. No se usaron documentos reales.

## Causa del CI anterior y correcciones

El primer run remoto de Phase 02 (`33333073276`) falló durante `supabase start`: el health check del contenedor `supabase_edge_runtime_changas` devolvió HTTP 503. La causa era un servicio Edge Runtime fuera del scope de Phase 02, no una falla de Postgres/Auth/Storage. Se consultó `supabase start --help` y se ajustó CI a `supabase@2.116.0 start --exclude edge-runtime`, conservando todos los servicios requeridos.

Las fallas posteriores fueron assertions/fixtures reales y se corrigieron de forma acotada:

- La regression de Phase 01 esperaba tres policies después de agregar la policy activa de pausa; se ajustó para comprobar la semántica owner-only, no un count obsoleto.
- Los slugs de fixtures se normalizaron a kebab-case porque el check de servicios no acepta `_`.
- El fixture de certificación incluyó MIME y tamaño requeridos por el check de evidencia.
- El assertion de `PER_UNIT` dejó de contar el check independiente de formato de `price_unit` y apunta al constraint combinado que exige precio y unidad.

## Validation gates

| Gate                            | Resultado | Evidencia                                                                                                                                     |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Install frozen                  | PASS      | `pnpm install --frozen-lockfile` local; workspace up to date                                                                                  |
| Lint                            | PASS      | `pnpm lint` local y job `validate`                                                                                                            |
| Typecheck                       | PASS      | `pnpm typecheck` local y job `validate`                                                                                                       |
| Unit tests                      | PASS      | `pnpm test`: 7 files, 16 tests                                                                                                                |
| Production build                | PASS      | `pnpm build`; rutas provider/manage, páginas públicas y API portfolio compiladas                                                              |
| Format check                    | PASS      | `pnpm format:check`                                                                                                                           |
| `git diff --check`              | PASS      | ejecución local                                                                                                                               |
| Supabase migration/reset local  | NOT RUN   | Docker no está instalado en el checkout Windows; `docker --version` no existe y CLI devolvió `LegacyLocalDbRunningError`/`ECONNREFUSED`       |
| Supabase DB lint local          | NOT RUN   | requiere Postgres local; CLI devolvió `LegacyDbConnectError`                                                                                  |
| Supabase migration/reset remoto | PASS      | run `33334743767`, `ubuntu-latest`, `start --exclude edge-runtime` y `db reset --local --no-seed`                                             |
| pgTAP remoto                    | PASS      | run `33334743767`: 4 archivos, 95 tests, `Result: PASS`                                                                                       |
| Runtime RLS/Storage remoto      | PASS      | run `33334743767`: `Supabase runtime security checks: PASS`                                                                                   |
| GitHub Actions remoto           | PASS      | [run 33334743767](https://github.com/gabsvm/changas/actions/runs/33334743767); `validate` y `supabase-integration` PASS                       |
| Mobile manual QA/screenshots    | NOT RUN   | este checkout sólo contiene `apps/web`; no hay cliente móvil ni dispositivo disponible, y el runtime Supabase local no existe en esta máquina |

El run remoto no usa credenciales Supabase Cloud: exporta las credenciales del stack local del runner y ejecuta usuarios/objetos sintéticos que se limpian al finalizar. Los logs muestran `Start local Supabase`, reset, pgTAP, runtime client/Storage y `Stop local Supabase` exitosos.

## Node.js y setup

El proyecto queda alineado a Node 24:

- `package.json`: `engines.node >=24.0.0` y `@types/node 24.13.3`.
- `.nvmrc`: `24.20.0`.
- GitHub Actions: Node `24.20.0` y pnpm `11.19.0` pinned.
- README y arquitectura documentan Node 24, Docker requerido sólo para Supabase local y el comando help-verified con Edge Runtime excluido.

La annotation visible en Actions sobre acciones internas que todavía apuntan a Node 20 es una advertencia del runtime de GitHub (`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`) forzada a Node 24; no es una compatibilidad declarada por el proyecto ni modifica el engine/runtime del checkout.

## Limitaciones y STOP

La evidencia Supabase runtime está PASS en CI, pero no se declara runtime local PASS. La QA manual móvil y screenshots quedan `NOT RUN` por ausencia de cliente móvil/dispositivo. Por esas limitaciones no se declara una aprobación final de Phase 02 más allá de la evidencia disponible.

La rama queda publicada en `origin/codex/phase-02-provider-marketplace` y el trabajo se detiene aquí. No se inicia Phase 03.
