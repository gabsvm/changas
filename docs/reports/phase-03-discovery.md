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

HEAD de trabajo: `f869ec38c153b23a264a30c3afafc47ce0ab0f6d`.

## Migración y arquitectura de búsqueda

La migración fue generada con Supabase CLI (`supabase migration new`) y es
`supabase/migrations/20260831025526_phase_03_discovery.sql`. No se reescribieron
las migraciones publicadas de Phase 01/02.

El cliente anónimo sólo ejecuta el RPC acotado
`public.search_discovery_services(...)`, con grants explícitos para `anon`,
`authenticated` y `service_role`; no consulta tablas privadas ni recibe una
vista de `service_areas`. La función es `SECURITY DEFINER`, fija
`search_path = pg_catalog, public, extensions`, valida límites de paginación,
precio, coordenadas, radio y orden, y devuelve como máximo 24 resultados por
página.

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
pesos de título/descripción. El índice GIN trigram cubre la concatenación
normalizada para tolerancia acotada a typos. Skills, categorías, tags y
`skill_synonyms` se combinan con coincidencias exactas y fuzzy. El catálogo
controlado agrega `electricista` y los sinónimos requeridos para
`arreglar pc`, `pc se apaga`, `clases ingles` e `instalar camara`; el seed
sintético publica ejemplos reales de catálogo, sin reviews ni jobs falsos.

## Ranking, filtros y ubicación

El ranking V1 es determinístico y explicable: relevancia textual acotada,
coincidencia exacta de skill/categoría, tag, sinónimo y un bonus pequeño por
distancia. No usa ratings, trabajos completados ni boosts pagos. La salida
ordena por recomendados, cercanía o precio ascendente/descendente, con slugs
como desempate estable. La función de ranking portable se prueba en
`packages/domain/src/discovery.test.ts`; queda preparada para sumar reputación
real en Phase 07 sin cambiar el contrato de descubrimiento.

`/buscar` mantiene estado en la URL y expone filtros de modalidad (Todos,
Presencial, Remoto), categoría, skill, radio, rango de precio, acepta ofertas y
modelo de precio. La semántica `BOTH` participa en Presencial y Remoto. Las
zonas manuales son centroides gruesos de catálogo, no coordenadas de usuarios.
La geolocalización del navegador sólo se solicita después de una acción
explícita y se envía al endpoint same-origin sin persistirla públicamente. Sin
ubicación, los resultados remotos y la búsqueda general siguen funcionando.

El lateral PostGIS usa `ST_DWithin` sobre `service_areas.center`, respeta
`is_active`, retorna la menor distancia de las áreas activas y conserva el
índice GiST existente. Se cubren radio interior/exterior, múltiples áreas,
área inactiva, servicios remotos y ausencia de coordenadas en el payload.

## Rutas públicas, favoritos y SEO

Se implementaron la homepage marketplace-first, `/buscar`,
`/categoria/[slug]`, `/p/[slug]` y `/p/[slug]/[serviceSlug]`. Las páginas de
contenido son server-rendered; sólo el control de geolocalización es client
component. La homepage no fuerza autenticación e incluye búsqueda, zonas,
categorías, remoto y CTA de provider.

`provider_favorites` tiene PK compuesta `(user_id, provider_user_id)`, RLS
owner-only y grants explícitos. Sus RPCs autenticados agregan/quitan sin
duplicados y listan únicamente providers públicos. Un visitante anónimo que
guarda un provider vuelve a `/login` con un return path validado; no existen
favoritos de jobs.

Homepage, categorías, providers y servicios tienen metadata pública, canonical
y OpenGraph. `sitemap.xml` sólo enumera catálogo y proyecciones públicas
activas; `robots.txt` bloquea account/provider/api/auth. No se generan claims de
rating, verificación o disponibilidad.

No se agregó mapa: las listas son primarias y no había un provider de mapas que
aportara valor sin introducir arquitectura, coordenadas o peso innecesarios.

## Pruebas y evidencia

La suite pgTAP `supabase/tests/phase-03-discovery.sql` comprueba grants y
ausencias deliberadas, EXECUTE público acotado, RLS de favoritos, contrato sin
coordenadas/privados, normalización, ejemplos de búsqueda, elegibilidad,
modalidades, FTS/sinónimos/tags, fuzzy, filtros, PostGIS y paginación. Se
conservan todas las suites Phase 01/02.

`apps/web/scripts/phase-03-discovery-runtime.mjs` crea usuarios y fixtures
sintéticos, prueba búsquedas mediante Supabase client, radius, remote,
eligibilidad, aislamiento de favoritos, self-activation y ausencia de campos
privados; limpia al finalizar. El job de Ubuntu levanta Supabase local con
Docker, hace reset desde cero, ejecuta pgTAP, ambos scripts, reset con seed y
Playwright desktop/Pixel 5. No usa credenciales de Supabase Cloud.

Playwright cubre home, búsqueda, filtros URL-addressable, categoría, apertura
de provider/servicio y flujo de favorito anónimo en viewport móvil Pixel 5.
Las pruebas de dominio cubren normalización, filtros acotados, ranking,
ubicaciones manuales y formato de dinero existente.

## Validation gates

| Gate                                | Resultado | Evidencia                                     |
| ----------------------------------- | --------- | --------------------------------------------- |
| Install frozen                      | PASS      | `pnpm install --frozen-lockfile` local y CI   |
| Lint                                | PASS      | `pnpm lint` local y job `validate`            |
| Typecheck                           | PASS      | `pnpm typecheck` local y job `validate`       |
| Unit tests                          | PASS      | `pnpm test`: 11 files, 27 tests               |
| Production build                    | PASS      | `pnpm build` local y job `validate`           |
| Format check                        | PASS      | `pnpm format:check` local y job `validate`    |
| `git diff --check`                  | PASS      | ejecución local y job `validate`              |
| Supabase migration/reset local      | NOT RUN   | Docker no está instalado en este Windows      |
| pgTAP local                         | NOT RUN   | requiere Docker/Postgres local                |
| Runtime RLS/Storage/search local    | NOT RUN   | requiere Docker/Postgres/Auth/Storage local   |
| Supabase reset/pgTAP/runtime remoto | PENDING   | run final de la rama en GitHub Actions        |
| Browser E2E desktop/Pixel 5 remoto  | PENDING   | run final de la rama en GitHub Actions        |
| GitHub Actions remoto               | PENDING   | se actualiza con el run final sobre este HEAD |

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

La annotation informativa de GitHub sobre actions internas que apuntan a Node
20 no cambia el runtime del proyecto: `package.json`, lockfile, `@types/node`,
`.nvmrc`, setup de Actions y documentación usan Node 24.

Las limitaciones locales quedan explícitas por Docker ausente. No se declara
Phase 03 terminada hasta que el run remoto final quede verde.
