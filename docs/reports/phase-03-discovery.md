# Phase 03 — Public discovery, search and SEO

## Estado y alcance

La rama es `codex/phase-03-discovery`, creada desde el HEAD aprobado de
Phase 02 `61de1aabe0d74805202d6fccfdce76f45ac03074`. El trabajo queda limitado
a descubrimiento público anónimo, búsqueda, filtros, favoritos de providers,
SEO y sus pruebas. No se inició Phase 04 ni se agregaron AI, embeddings, chat,
jobs, pagos, propuestas, reviews, reputación, notificaciones o administración.

También se corrigió primero la evidencia documental de Phase 02: el report
ahora declara HEAD `61de1aabe0d74805202d6fccfdce76f45ac03074` y CI
`33350924892`. Esa corrección no reabrió Phase 02.

## Commits de Phase 03

- `c20998a` — `docs(phase02): correct approved audit evidence`
- `900b196` — `feat(phase03): add public discovery search and favorites`
- `6c619e8` — `fix(phase03): avoid discovery RPC parameter collisions`
- `9456449` — `fix(phase03): correct discovery lateral join syntax`
- `c825546` — `test(phase03): seed inactive area fixture safely`
- `39fcd14` — `fix(phase03): qualify discovery result columns`
- `47e3a6b` — `feat(phase03): expose complete discovery filters`
- `f869ec3` — `test(phase03): cover URL discovery filters`
- `1882ff3` — `docs(phase03): record discovery architecture and validation`
- `c384727` — `style(phase03): format discovery report`
- `ed55f98` — `test(phase03): exercise combined discovery filters`
- `0531410` — `test(phase03): use seeded service in filter journey`
- `0113986` — `fix(phase03): harden discovery audit contracts`
- `ace4311` — `ci(phase03): run explain in one database statement`

HEAD funcional validado: `ace4311f17bada58e2c833d756907dee62339a6d`.
El commit posterior de este reporte sólo actualiza evidencia documental.

## Migración y arquitectura de búsqueda

Las migraciones fueron generadas con Supabase CLI (`supabase migration new`). La
migración original es `supabase/migrations/20260831025526_phase_03_discovery.sql`
y la migración incremental de auditoría es
`supabase/migrations/20260831044750_phase_03_audit_hardening.sql`. No se
reescribieron migraciones publicadas de Phase 01/02 ni la primera migración de
Phase 03.

El cliente anónimo usa el RPC acotado
`public.search_discovery_services_v2(...)`, con grants explícitos para `anon`,
`authenticated` y `service_role`; no consulta tablas privadas ni recibe una
vista de `service_areas`. La función es `SECURITY DEFINER`, fija
`search_path = pg_catalog, public, extensions`, valida límites de paginación,
precio, coordenadas, radio y orden, devuelve como máximo 24 resultados por
página y agrega `has_more` mediante una fila adicional acotada. El RPC
publicado anterior se conserva como wrapper seguro sin el campo de paginación;
ambos terminan en el read model corregido.

La elegibilidad se aplica dentro del RPC:

- provider `ACTIVE` y `marketplace_paused = false`;
- service `is_published = true` y `is_paused = false`;
- skill y category activos.

El modelo de resultado es service-céntrico y seguro: nombre/avatar/slug del
provider, zona aproximada, título y slug de servicio, categoría, skill,
modalidad, modelo/precio ARS, unidad, ofertas, distancia aproximada y
relevancia. No incluye email, teléfono privado, DNI, dirección, evidencia,
ratings, jobs, badges ni centros geográficos.

La normalización determinística vive también en PostgreSQL, mediante
`normalize_search_text(text)`: lower-case, reducción de whitespace y
normalización controlada de acentos/ñ. La aplicación usa el mismo criterio para
URL y geolocalización, pero la búsqueda no depende de JavaScript.

El índice generado `services.search_document` usa PostgreSQL FTS `simple` con
pesos de título/descripción. La auditoría agregó la columna generada almacenada
`services.search_text_normalized` y reconstruyó
`services_search_text_trgm_idx` sobre esa misma expresión; el predicado fuzzy
usa el operador indexable `OPERATOR(extensions.%)` sobre la columna almacenada.
Skills, categorías, tags y
`skill_synonyms` se combinan con coincidencias exactas y fuzzy. El catálogo
controlado agrega `electricista` y los sinónimos requeridos para
`arreglar pc`, `pc se apaga`, `clases ingles` e `instalar camara`; el seed
sintético publica ejemplos reales de catálogo, sin reviews ni jobs falsos.

## Ranking, filtros y ubicación

El ranking V1 es determinístico y explicable: relevancia textual acotada,
coincidencia exacta de skill/categoría, tag, sinónimo y un bonus pequeño por
distancia. La migración de auditoría suma `0.04` sólo a providers creados en
los últimos 30 días; es un pequeño mecanismo de exposición aislado, no domina
la relevancia, no aleatoriza y no usa ratings/jobs. No hay boosts pagos. La salida
ordena por recomendados, cercanía o precio ascendente/descendente, con slugs
como desempate estable. La función de ranking portable se prueba en
`packages/domain/src/discovery.test.ts`; queda preparada para sumar reputación
real en Phase 07 sin cambiar el contrato de descubrimiento.

`/buscar` mantiene estado en la URL y expone filtros de modalidad (Todos,
Presencial, Remoto), categoría, skill, radio, rango de precio, acepta ofertas y
modelo de precio. La URL usa ARS en unidades mayores (por ejemplo
`min=8000&max=10000`), mientras que `DiscoveryFilters` y el RPC usan minor
units (`800000`/`1000000`). El endpoint de geolocalización valida el contrato
interno sin volver a convertir los importes. Las formas vuelven a renderizar
valores humanos. La navegación `Anterior`/`Siguiente` es URL-addressable,
conserva los filtros públicos y sólo se muestra cuando `has_more` lo demuestra.

La semántica `BOTH` participa en Presencial y Remoto. Las zonas manuales son
centroides gruesos de catálogo, no coordenadas de usuarios. La geolocalización
del navegador sólo se solicita después de una acción explícita y se envía al
endpoint same-origin sin persistirla públicamente. Sin ubicación, los resultados
remotos y la búsqueda general siguen funcionando.

El lateral PostGIS usa dos predicados `ST_DWithin` sobre `service_areas.center`:
la distancia debe estar dentro del radio solicitado por el cliente y dentro de
`service_areas.radius_meters`; sólo considera áreas activas, retorna la menor
distancia segura y conserva el GiST existente. Esto cubre los casos
20 km/5 km/25 km (excluido), 4 km/5 km/10 km (incluido) y 8 km/10 km/5 km
(excluido), además de múltiples áreas, áreas inactivas y servicios remotos.

## Rutas públicas, favoritos y SEO

Se implementaron la homepage marketplace-first, `/buscar`,
`/categoria/[slug]`, `/p/[slug]` y `/p/[slug]/[serviceSlug]`. Las páginas de
contenido son server-rendered; sólo el control de geolocalización es client
component. La homepage no fuerza autenticación e incluye búsqueda, zonas,
categorías, remoto y CTA de provider.

`provider_favorites` tiene PK compuesta `(user_id, provider_user_id)`, RLS
owner-only y grants explícitos. Desde la auditoría `authenticated` conserva
únicamente SELECT; no tiene INSERT/UPDATE/DELETE ni policies de escritura.
Sus RPCs autenticados agregan/quitan sin duplicados y sólo aceptan providers
ACTIVE no pausados, con `auth.uid()` validado dentro de la función
`SECURITY DEFINER`. Un visitante anónimo que
guarda un provider vuelve a `/login` con un return path validado; no existen
favoritos de jobs.

La metadata raíz configura `metadataBase` con `getPublicSiteUrl()`, por lo que
canonical y OpenGraph relativos de home, categorías, providers y servicios se
resuelven contra el origen público configurado. `sitemap.xml` y `robots.txt`
usan el mismo helper; `/buscar` es `noindex, follow` para no indexar una
combinatoria ilimitada de query strings. No se generan claims de rating,
verificación o disponibilidad.

No se agregó mapa: las listas son primarias y no había un provider de mapas que
aportara valor sin introducir arquitectura, coordenadas o peso innecesarios.

## Pruebas y evidencia

La suite pgTAP `supabase/tests/phase-03-discovery.sql` (43 assertions) comprueba grants y
ausencias deliberadas, EXECUTE público acotado, RLS de favoritos, contrato sin
coordenadas/privados, normalización, ejemplos de búsqueda, elegibilidad,
modalidades, FTS/sinónimos/tags, fuzzy/index almacenado, filtros, ambos radios,
PostGIS y paginación `has_more`. Se
conservan todas las suites Phase 01/02.

`apps/web/scripts/phase-03-discovery-runtime.mjs` crea usuarios y fixtures
sintéticos, prueba búsquedas mediante Supabase client, radius, remote,
eligibilidad, los tres casos de cobertura propia y cliente, paginación,
aislamiento de favoritos (activo/pausado/inactivo/anónimo/direct write),
self-activation y ausencia de campos privados; limpia al finalizar. El job de
Ubuntu levanta Supabase local con Docker, hace reset desde cero, ejecuta pgTAP,
ambos scripts, una comprobación EXPLAIN del índice trigram, reset con seed y
Playwright desktop/Pixel 5. No usa credenciales de Supabase Cloud.

Playwright cubre home, búsqueda, filtros URL-addressable con ARS mayor,
paginación, categoría, apertura de provider/servicio y flujo de favorito anónimo
en viewport desktop y Pixel 5. Las pruebas de dominio cubren normalización,
conversión mayor→minor sin doble conversión, filtros acotados, ranking,
ubicaciones manuales y formato de dinero existente.

## Validation gates

| Gate                                | Resultado | Evidencia                                                                                      |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| Install frozen                      | PASS      | `pnpm install --frozen-lockfile` local y CI                                                    |
| Lint                                | PASS      | `pnpm lint` local y job `validate`                                                             |
| Typecheck                           | PASS      | `pnpm typecheck` local y job `validate`                                                        |
| Unit tests                          | PASS      | `pnpm test`: 11 files, 30 tests                                                                |
| Production build                    | PASS      | `pnpm build` local y job `validate`                                                            |
| Format check                        | PASS      | `pnpm format:check` local y job `validate`                                                     |
| `git diff --check`                  | PASS      | ejecución local y job `validate`                                                               |
| Supabase migration/reset local      | NOT RUN   | Docker no está instalado en este Windows                                                       |
| pgTAP local                         | NOT RUN   | requiere Docker/Postgres local                                                                 |
| Runtime RLS/Storage/search local    | NOT RUN   | requiere Docker/Postgres/Auth/Storage local                                                    |
| Supabase reset/pgTAP/runtime remoto | PASS      | run `33359111198`, Ubuntu/Docker, reset limpio, 43 pgTAP, runtime y seed sintético             |
| EXPLAIN fuzzy index remoto          | PASS      | run `33359111198`, `services_search_text_trgm_idx` verificado con `enable_seqscan=off`         |
| Browser E2E desktop/Pixel 5 remoto  | PASS      | run `33359111198`, journeys Phase 03 en ambos proyectos                                        |
| GitHub Actions remoto               | PASS      | [run 33359111198](https://github.com/gabsvm/changas/actions/runs/33359111198), ambos jobs PASS |

## Causa de fallos CI durante la implementación

- Run `33353414793`: la migración usaba nombres de parámetros que colisionaban
  con columnas OUT del RPC; se renombraron los filtros de categoría/skill.
- Run `33353638031`: la sintaxis `CROSS JOIN LATERAL ... ON true` era inválida;
  se corrigió a `JOIN LATERAL ... ON true`.
- Run `33353806454`: el fixture de un provider `PROFILE_INCOMPLETE` intentaba
  publicar un servicio y activaba correctamente la guard de Phase 02; el
  servicio se crea no publicado y se habilita sólo después de activar el
  fixture para probar el área inactiva.
- Run `33354126458`: `distance_meters` era ambiguo entre el resultado OUT y la
  CTE; se calificaron las columnas del resultado y del ranking.
- Run `33354740431`: las primeras aserciones E2E eran ambiguas para enlaces de
  categorías repetidos y tomaban la opción oculta `Remoto`; se limitaron al
  enlace visible y al contenido del artículo.
- Run `33355056275`: el reporte nuevo no estaba formateado; se ejecutó
  Prettier y se volvió a publicar.
- Run `33358870104`: la nueva evidencia EXPLAIN pasó por `db query` dos
  sentencias (`SET` + `EXPLAIN`) en un prepared statement, que Supabase CLI
  rechazó con `cannot insert multiple commands into a prepared statement`.
  Se corrigió ejecutando un único bloque `DO` que configura la sesión, captura
  el plan y falla si no aparece el índice; no se modificó el SQL de búsqueda.
- Run `33359111198`: PASS final de validate y supabase-integration después de
  esa corrección, incluyendo reset, pgTAP, runtime, EXPLAIN y E2E desktop/Pixel 5.

La annotation informativa de GitHub sobre actions internas que apuntan a Node
20 no cambia el runtime del proyecto: `package.json`, lockfile, `@types/node`,
`.nvmrc`, setup de Actions y documentación usan Node 24.

Las limitaciones locales quedan explícitas por Docker ausente. El runtime
reproducible remoto y el CI final quedaron verdes; no se agregan afirmaciones
de reputación, disponibilidad o verificación que Phase 03 no pueda probar.

## Final audit hardening — final evidence

Esta segunda corrección permanece exclusivamente en `codex/phase-03-discovery`
y partió del HEAD auditado `dd8874ab6dcec555cf70aca6e6894068f4a4caf3`. El
HEAD final es `cabc192bc92bb16c20e4a0781b02f7e3f8cc5103`, con commits de esta
corrección `b976f47`, `6a16b2d`, `3406c4e` y `cabc192`. Se agregó
la migración nueva `20260831155937_phase_03_final_audit_fix.sql`; no se
reescribieron migraciones publicadas.

- La búsqueda pública usa `service_areas.public_search_center`, una celda
  aproximada de 0,01 grados (~1,1 km), mantenida por trigger desde el centro
  preciso privado. El centro exacto sólo permanece para workflows owner/admin.
  El contrato público cambió de `distance_meters` a buckets
  `UNDER_2_KM`, `KM_2_TO_5`, `KM_5_TO_10`, `KM_10_TO_25` y `OVER_25_KM`.
  La RPC interna conserva metros sólo dentro de la función revocada; la RPC
  pública `search_discovery_services_v3` no expone coordenadas ni distancia
  entera.
- La semántica de radio sigue exigiendo área activa, radio propio y radio del
  cliente; `BOTH` no requiere geografía cuando se consulta como remoto. El
  default de producto para GPS/manual con ubicación es 10 km; el máximo SQL
  defensivo sigue siendo 100 km.
- `Buscar cerca mío` ahora es un modo explícito en memoria: reinicia página,
  conserva filtros y coordenadas sólo en el componente, usa `/api/discovery`
  para anterior/siguiente, consume `hasMore` y oculta la paginación SSR. No
  coloca coordenadas en URL ni storage.
- Los avatares externos no se renderizan: sólo se acepta un path first-party
  `/api/avatar/` en el origen de `getPublicSiteUrl()`; el resto usa iniciales.
  Los errores de discovery y favorite son accionables y no muestran errores
  crudos de Supabase.
- Sitemap usa rangos paginados de Data API y divide resultados en chunks de
  50.000 URLs. Se agregó `adjustedRating`, utility puro ponderado con prior,
  sin usar ratings en discovery ni crear reviews tempranas.
- Se agregó auditoría Lighthouse mobile para `/` y `/buscar` en CI con umbral
  no flaky de performance 0,45, sin dependencia en el bundle de producción.
  La prueba Playwright agrega geolocalización mockeada, paginación GPS y
  ausencia de coordenadas en URL.

## Evidence for final audit hardening

La suite local de Vitest queda en 13 archivos y 35 tests PASS; lint, typecheck,
build y format check también pasan. El intento de Supabase local sigue NOT RUN
porque este Windows no tiene Docker ni Podman. El reset limpio, pgTAP (45
assertions), runtime RLS/Storage/discovery, EXPLAIN y Playwright desktop/Pixel 5
quedaron PASS en el nuevo run remoto `33413855281`: [GitHub Actions CI
33413855281](https://github.com/gabsvm/changas/actions/runs/33413855281). El
runtime probó privacidad del contrato público, elegibilidad/radios, favoritos,
RLS y Storage; EXPLAIN verificó el camino trigram; los 24 journeys Playwright
pasaron (12 desktop y 12 Pixel 5), incluyendo geolocalización mockeada,
paginación next/previous y ausencia de coordenadas en URL. Lighthouse mobile
contra el build de producción obtuvo performance 66 para `/` y 94 para
`/buscar`, ambos sobre el umbral CI 0,45.
