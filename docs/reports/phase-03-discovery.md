# Phase 03 — Public discovery, search and SEO

## Estado final

**Rama:** `codex/phase-03-discovery`  
**Base aprobada de Phase 02:** `61de1aabe0d74805202d6fccfdce76f45ac03074`  
**HEAD funcional validado previo al cierre documental:** `bc4bd2c897e3c32cdc6f55a67bc06ec0e919942a`  
**CI funcional final:** GitHub Actions run `33422211214`  
**Resultado:** **PASS** en `validate` y `supabase-integration`.

Phase 03 queda limitada a descubrimiento público, búsqueda, filtros, ubicación aproximada, favoritos de providers, SEO, sitemap y pruebas asociadas. No se inició Phase 04 en esta rama y no se agregaron chat, propuestas, jobs, pagos, reviews, reputación, notificaciones ni administración.

## Implementación entregada

### Marketplace y descubrimiento

Se implementaron:

- homepage pública marketplace-first;
- `/buscar` con estado URL-addressable para filtros públicos;
- navegación por categorías;
- páginas públicas SSR/indexables de provider y servicio;
- búsqueda PostgreSQL FTS;
- sinónimos, tags y matching fuzzy con `pg_trgm`;
- ranking determinístico V1;
- exposición moderada para providers nuevos;
- filtros de modalidad, categoría, skill, radio, precio, modelo de precio y aceptación de ofertas;
- descubrimiento remoto sin requerir ubicación;
- favoritos de providers para usuarios autenticados;
- geolocalización explícita del navegador sin persistir coordenadas en URL o storage;
- ubicación manual aproximada;
- consultas PostGIS con radio del cliente y cobertura real del provider.

La búsqueda pública usa `search_discovery_services_v3`. El contrato público no expone coordenadas precisas ni metros exactos. La distancia pública se entrega en buckets (`UNDER_2_KM`, `KM_2_TO_5`, `KM_5_TO_10`, `KM_10_TO_25`, `OVER_25_KM`).

`service_areas.public_search_center` conserva una celda geográfica aproximada para discovery. El centro preciso permanece fuera del contrato público.

### Seguridad y privacidad

El discovery público sólo devuelve información destinada a marketplace. No expone email privado, teléfono privado, DNI, dirección exacta, documentos, evidencia, coordenadas precisas ni datos contractuales.

`provider_favorites` usa RLS owner-only. Los writes directos desde el rol autenticado permanecen revocados y las operaciones públicas pasan por RPCs autenticados acotados.

La elegibilidad pública exige provider `ACTIVE`, marketplace no pausado, servicio publicado/no pausado y catálogo activo.

### SEO y sitemap

Se implementaron:

- metadata canónica y OpenGraph sobre el origen público configurado;
- `robots.txt`;
- `/buscar` como `noindex, follow` para evitar combinatoria de URLs;
- `sitemap.xml` como sitemap index;
- `/sitemaps/[id]` como chunks reales;
- límite máximo de 50.000 URLs por chunk;
- consulta paginada y orden determinístico para no depender de cargar todo el catálogo en memoria.

El sitemap dinámico no depende de sesión/cookies y utiliza únicamente el cliente público autorizado.

### UX de error y GPS

El modo `Buscar cerca mío` conserva las coordenadas únicamente en memoria del componente. La paginación GPS usa el endpoint same-origin y no serializa coordenadas en la URL.

Los errores de discovery son recuperables. Un retry GPS exitoso limpia el error previo y permite continuar la navegación sin recargar toda la aplicación.

### Performance

CI ejecuta Lighthouse mobile sobre `/` y `/buscar` contra el build de producción. El umbral mínimo de performance quedó fijado en **60** para ambas rutas.

En el run funcional final `33422211214`:

- `/` → **76**;
- `/buscar` → **95**.

No se agregó mapa ni bundle de mapas en Phase 03. La lista continúa siendo la superficie principal.

## Migraciones de Phase 03

Las migraciones se agregaron de forma incremental; no se reescribieron migraciones compartidas:

- `20260831025526_phase_03_discovery.sql`;
- `20260831044750_phase_03_audit_hardening.sql`;
- `20260831155937_phase_03_final_audit_fix.sql`.

## Evidencia de pruebas final

GitHub Actions run `33422211214` validó el HEAD funcional `bc4bd2c897e3c32cdc6f55a67bc06ec0e919942a`.

### Job `validate`

PASS en:

- `pnpm install --frozen-lockfile`;
- lint;
- typecheck;
- Vitest;
- production build;
- Prettier/format check;
- `git diff --check`.

Vitest: **13 archivos / 35 tests PASS**.

### Job `supabase-integration`

PASS en:

- Supabase local desde cero;
- reset completo de DB;
- aplicación de todas las migraciones;
- pgTAP completo: **6 archivos / 164 assertions PASS**;
- comprobación EXPLAIN del índice `services_search_text_trgm_idx`;
- runtime de seguridad RLS/Storage;
- runtime de seguridad específico de Discovery;
- reset con seed sintético;
- build para browser smoke tests;
- Lighthouse mobile;
- Playwright desktop y Pixel 5;
- shutdown limpio de Supabase.

Playwright: **28/28 journeys PASS**. Incluye búsqueda, filtros, categorías, paginación, páginas compartibles, favoritos anónimos, sitemap index/chunks, GPS paginado y recuperación después de un error GPS.

## Incidencias relevantes resueltas durante la fase

Durante la implementación se detectaron y corrigieron problemas reales de SQL/RPC, fixtures, ambigüedad de columnas, sintaxis lateral, EXPLAIN, sitemap dinámico de Next y formato. Ninguno queda abierto en el HEAD funcional validado.

El primer enfoque de sitemap usando generación estática de Next chocaba con acceso a cookies durante build. Se reemplazó por rutas runtime sin sesión, manteniendo el sitemap index/chunks y evitando depender del contexto de autenticación.

La descarga inicial de imágenes Docker de Supabase recibió rate limiting temporal de ECR durante el run final, pero la CLI reintentó y el entorno inició correctamente; todos los tests posteriores pasaron.

## Cierre de Phase 03

Los criterios del master plan quedan cubiertos:

- browsing anónimo sin auth wall;
- búsqueda útil sin IA;
- filtros y radius server-backed;
- privacidad de ubicación y campos privados;
- páginas públicas SSR/indexables;
- SEO y sitemap escalable;
- performance mobile con threshold ejecutable en CI;
- sin bundle de mapa innecesario;
- RLS/runtime/E2E verdes.

**Phase 03 queda aprobada para servir como base de `codex/phase-04-conversations`.**
