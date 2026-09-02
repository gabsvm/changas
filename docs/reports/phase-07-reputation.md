# Phase 07 — Reviews, ranking and repeat hiring

## Estado final

**Fase:** Phase 07 — Reviews, ranking and repeat hiring
**Rama:** `codex/phase-07-reputation`
**Base aprobada (Phase 06):** `fd98490a61ef763fb4e9c7041490214a1faee971`
**CI aprobado de Phase 06:** `33578965225`
**Functional HEAD SHA:** `5335c9cd86e9c5ad5d3aa3eeafff64e57d2f5b25`
**Functional CI RUN ID:** `33590758862`
**validate:** `success`
**supabase-integration:** `success`
**Vitest:** 28 archivos, 80 tests passed
**pgTAP:** 23 archivos, 352 tests passed
**Playwright:** 38 tests passed (19 Chromium desktop + 19 Pixel 5/mobile-web)
**Lighthouse mobile:** Home `/` = 82 | Search `/buscar` = 95

La implementación funcional de Phase 07 queda en **PASS** contra el alcance y los criterios de aceptación de `CHANGAS_MASTER_PLAN.md`. La aprobación formal de la fase exige además que el commit que contiene este reporte mantenga el mismo pipeline CI completamente GREEN; el SHA y CI exactos de ese cierre quedan registrados en la respuesta final de aprobación para evitar auto-referencias imposibles dentro del propio commit.

---

## 1. Alcance implementado

1. **Review eligibility server-authoritative**
   - Sólo el cliente original de un Job `COMPLETED` puede reseñar al proveedor de ese Job.
   - Un Job admite una única review mediante `reviews.job_id unique` y validación adicional en `create_job_review`.
   - Se rechaza self-review tanto por constraint como por RPC.

2. **Rating 1–5**
   - `rating` obligatorio entre 1 y 5, validado en tabla y RPC.

3. **Review text**
   - Texto opcional normalizado, con longitud entre 2 y 2000 caracteres cuando está presente.

4. **Relación con Job, servicio, skill y categoría**
   - Cada review conserva `job_id`, `service_id`, `skill_id` y `category_id`.
   - También congela snapshots de título del servicio, skill y categoría para conservar contexto histórico auditable.

5. **Dimensiones opcionales limitadas**
   - `quality_rating`, `punctuality_rating` y `communication_rating`, todas opcionales y limitadas a 1–5.

6. **Respuesta pública del proveedor**
   - El proveedor reseñado puede crear o actualizar una única respuesta pública por review mediante `upsert_provider_review_reply`.
   - Ningún otro usuario puede responder en nombre del proveedor.

7. **Reporte de reviews**
   - Reviews pueden reportarse con razones estructuradas: amenazas, insultos, información privada, discriminación, contenido irrelevante, extorsión, abuso u otros.
   - Un usuario no puede reportar su propia review y cada usuario mantiene como máximo un reporte por review.

8. **Métricas agregadas de proveedor**
   - Promedio de rating y promedio ajustado con prior del marketplace.
   - Cantidad de reviews.
   - Promedios de calidad, puntualidad y comunicación.
   - Jobs completados, observados, cancelados y no-show.
   - Tasas de completion, cancellation y no-show.
   - Cantidad de clientes recurrentes.

9. **Agregados por skill y servicio**
   - `list_public_provider_reputation_context` expone reputación contextual por skill y servicio, no sólo un promedio global.

10. **Métricas de completion/cancellation**
    - Se calculan desde Jobs observables terminales (`COMPLETED`, `CANCELLED`, `NO_SHOW`) y no desde contadores editables por usuario.

11. **Response-time metric sólo si es fiable**
    - No se introdujo una métrica de tiempo de respuesta artificial ni derivada de una señal no autoritativa.
    - La migración documenta explícitamente que response time permanece omitido hasta poder medirlo de forma fiable. Esto sigue la condición `if reliable` del Master Plan.

12. **Repeat-client count**
    - Se cuenta como cliente recurrente a quien tiene al menos dos Jobs `COMPLETED` con el proveedor dentro del contexto consultado.

13. **Ranking actualizado**
    - Discovery V4 combina relevancia textual/contextual, distancia cuando corresponde, `adjusted_rating`, Jobs completados, completion rate, repeat-client count y exposición controlada para proveedores nuevos.
    - `best-rated` usa rating ajustado + cantidad de reviews; `most-completed` usa Jobs completados + rating ajustado.
    - El raw rating no es la única señal de ranking.

14. **Favorites polish**
    - `list_my_favorite_providers_v2` agrega rating, review count, Jobs completados, completion rate y repeat-client count a proveedores guardados.
    - `/account/favorites` presenta esas señales en la experiencia autenticada.

15. **Rehire desde Job completado**
    - `create_rehire_proposal` sólo permite al cliente original volver a contratar desde un Job `COMPLETED`.
    - Se crea una conversación y propuesta nuevas.
    - La propuesta nueva usa disponibilidad/publicación, price model y schedule type actuales del servicio; no reabre ni modifica el Job histórico.

16. **Exposición de proveedores nuevos**
    - Discovery V4 incorpora un pequeño boost acotado para proveedores creados en los últimos 30 días que todavía no tienen Jobs completados.
    - El boost no reemplaza la relevancia ni permite fabricar reputación.

17. **Anti-manipulation constraints**
    - Review verificada por Job completado y cliente real.
    - Unique review por Job.
    - Self-review bloqueada.
    - Reviews publicadas son inmutables: update/delete dispara `reviews_immutable_guard`.
    - El proveedor no puede borrar una mala review; sólo responderla o reportarla mediante los flujos autorizados.
    - Métricas y ranking se derivan de reviews/Jobs autoritativos, no de campos de reputación editables en perfil.

---

## 2. Migraciones principales

- `supabase/migrations/20260902020000_phase_07_reviews.sql`
  - `reviews`, `review_replies`, `review_reports`.
  - elegibilidad, validaciones, inmutabilidad, RLS/grants y RPCs de review/reply/report.
- `supabase/migrations/20260902021000_phase_07_reputation_metrics.sql`
  - métricas agregadas globales y contextuales.
  - read models públicos de reputación y reviews.
  - promedio ajustado para reducir el efecto de muestras pequeñas.
- `supabase/migrations/20260902021500_phase_07_discovery_rank.sql`
  - `search_discovery_services_v4` y ranking multi-señal.
  - sort modes reputacionales y exposición acotada de proveedores nuevos.
- `supabase/migrations/20260902023000_phase_07_account_reputation_rehire.sql`
  - `create_rehire_proposal`.
  - `get_job_review_state`.
  - `list_my_favorite_providers_v2`.

---

## 3. Código de aplicación y UI

- `apps/web/src/lib/reputation/server.ts`
- `apps/web/src/lib/reputation/server-job-actions.test.ts`
- `apps/web/src/app/(account)/jobs/actions.ts`
- `apps/web/src/components/reputation/job-reputation-panel.tsx`
- `apps/web/src/app/(account)/jobs/[jobId]/page.tsx`
- `apps/web/src/app/(account)/account/favorites/page.tsx`
- `apps/web/src/lib/discovery/types.ts`
- `apps/web/src/components/discovery/discovery-results.tsx`
- `tests/e2e/phase-07-reputation.spec.ts`

El detalle de un Job completado permite publicar la review verificada y volver a contratar. Una vez publicada la review, el estado server-side impide ofrecer otra review para el mismo Job. El rehire redirige a la nueva conversación/propuesta, nunca al Job histórico.

---

## 4. Seguridad, RLS y autoridad del servidor

- Las mutaciones sensibles se realizan mediante RPCs `SECURITY DEFINER` con `search_path` fijado.
- Las tablas de reviews/replies/reports tienen RLS y grants restrictivos.
- La creación de reviews valida autenticación, actor, estado del Job, self-review, duplicado y contexto histórico.
- Las reviews ya publicadas no admiten update/delete directo.
- La respuesta del proveedor valida que el actor sea exactamente el proveedor reseñado.
- Los reportes son privados para su autor en lectura autenticada y están deduplicados por `(review_id, reporter_user_id)`.
- El rehire valida actor, Job completado y disponibilidad pública actual del servicio/proveedor antes de crear el nuevo flujo.

---

## 5. Ranking y reputación

La recomendación por defecto no ordena por estrellas crudas. `search_discovery_services_v4` incorpora:

- relevancia textual y coincidencias exactas de skill/categoría/tag/sinónimo;
- distancia cuando existe contexto geográfico;
- rating ajustado con prior y tamaño de muestra;
- Jobs completados;
- completion rate;
- repeat-client count;
- un boost pequeño y limitado para proveedor nuevo.

Esto evita que una sola review de 5 estrellas domine el ranking y evita que un proveedor sin historial quede completamente enterrado sólo por ser nuevo.

---

## 6. Repeat hiring

`create_rehire_proposal` preserva dos invariantes:

1. el Job anterior permanece histórico e inmutable;
2. el nuevo intento de contratación usa los términos actuales del servicio.

Para servicio `FIXED` + `UNSCHEDULED` se crea `DIRECT_BOOKING`; para los demás casos se crea `QUOTE_REQUEST`. La propuesta nueva vuelve a recorrer el flujo normal de propuestas/Jobs de las fases anteriores.

---

## 7. Evidencia de pruebas y cierre funcional

### Vitest

- **28 archivos**.
- **80 tests passed**.
- Incluye boundary tests para `get_job_review_state`, creación de review, reply/report y rehire.

### pgTAP

- **23 archivos**.
- **352 tests passed**.
- Incluye:
  - `phase-07-reviews.sql`;
  - `phase-07-reputation-metrics.sql`;
  - `phase-07-rehire-favorites.sql`.

### Runtimes de integración

Todos PASS en Functional CI `33590758862`:

- Supabase client/Storage runtime security.
- Phase 03 discovery runtime.
- Phase 04 conversations runtime.
- Phase 05 proposals/payment runtime.
- Phase 06 scheduling/holds runtime.
- Phase 06 transactional scheduling integrity runtime.
- Phase 06 exact-location runtime.
- Phase 06 Jobs runtime.
- **Phase 07 verified review authority runtime.**
- **Phase 07 reputation metrics/ranking runtime.**
- **Phase 07 rehire/account reputation runtime.**

### Browser E2E

- **38/38 passed**.
- **19 Chromium desktop + 19 Pixel 5/mobile-web**.
- Phase 07 E2E verifica desde navegador que un Job completado soporta una sola review verificada, rehire y favoritos con reputación.
- El suite también conserva las garantías de Phase 02–06.

### Lighthouse mobile

- Home `/`: **82**.
- Search `/buscar`: **95**.
- Ambos superan el umbral CI requerido.

---

## 8. RED → GREEN y debugging relevante

Durante el cierre final, el primer CI completo con la UI de Phase 07 llegó hasta Playwright y falló en cuatro casos heredados de Phase 03: dos escenarios GPS ejecutados en desktop y mobile.

La causa raíz no era producción. Phase 07 endureció el contrato de filas de discovery para exigir los nuevos campos reputacionales; los mocks E2E GPS todavía devolvían el schema anterior y el guard de UI descartaba esas filas.

Fix aplicado en `tests/e2e/phase-03-discovery.spec.ts`:

- se añadieron únicamente los campos actuales de reputación a los dos fixtures GPS;
- no se modificó lógica de producción;
- commit funcional: `5335c9cd86e9c5ad5d3aa3eeafff64e57d2f5b25`.

Resultado GREEN posterior:

- validate PASS;
- 352/352 pgTAP PASS;
- todos los runtimes Phase 03–07 PASS;
- Lighthouse PASS;
- 38/38 Playwright PASS.

---

## 9. Acceptance checklist

- [x] No review without completed job.
- [x] No duplicate unauthorized review.
- [x] User cannot review themselves.
- [x] Service context retained.
- [x] Provider cannot delete bad review.
- [x] Raw rating is not the only ranking signal.
- [x] Rehire creates a new proposal/job flow and never reopens the old Job.

---

## 10. Limitaciones y trabajo diferido explícitamente

- **Response-time metric:** deliberadamente no implementada todavía porque no existe una fuente server-side suficientemente fiable para medirla. No se inventó una aproximación engañosa.
- **Moderación administrativa de reportes:** Phase 07 crea el flujo de reporte y su referencia auditable; herramientas operativas/admin avanzadas pertenecen a una fase posterior de moderación/operaciones.
- **Notificaciones:** no se adelantó Phase 08.
- **Pagos reales:** no se adelantó Phase 11; se mantienen los boundaries ya establecidos en fases previas.

---

## 11. Riesgos y desviaciones

- No quedan desviaciones conocidas que bloqueen los criterios de aceptación de Phase 07.
- El único ajuste de cierre fue actualizar fixtures E2E GPS al contrato V4 de discovery; no cambió comportamiento productivo.
- El pipeline mostró rate limiting transitorio al descargar imágenes Docker de Supabase, pero el propio CLI reintentó y el job terminó exitosamente; no es una falla funcional del proyecto.

---

## Dictamen

**PHASE 07 — PASS / APPROVED**, condicionado únicamente a que el commit que contiene este reporte complete su propio CI final en verde, requisito que se verifica antes de emitir la aprobación al usuario.

**STOP:** Phase 07 completada. No iniciar Phase 08 sin aprobación explícita.
