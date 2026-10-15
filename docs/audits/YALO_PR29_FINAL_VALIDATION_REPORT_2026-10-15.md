# YALO — Informe de Validación Definitiva del PR #29 con Docker y WSL2

**Fecha de ejecución:** 15 de Octubre de 2026  
**Rama:** `fix/yalo-spec-v1-audit-integrity-20261015`  
**PR:** [#29 (gabsvm/changas)](https://github.com/gabsvm/changas/pull/29)  
**SHA base inicial:** `a557dd9`  
**Último SHA auditado:** `5c080e5`  
**Estado:** **APROBADO CON OBSERVACIONES (LISTO PARA REVISIÓN DE CÓDIGO - STOP PRE-MERGE)**  
**Cumplimiento Engineering Standard:** v1.1 (Desarrollo proporcional, evidencia empírica y cierre)

---

## 1. Entorno de Ejecución y Versiones de Herramientas

La validación se ejecutó íntegramente sobre una instancia local aislada y descartable mediante Docker sobre WSL2 (Ubuntu Linux container backend).

- **Sistema Operativo:** Windows 11 + WSL2 Linux Kernel 6.6.x (Ubuntu)
- **Node.js:** `v26.4.0` (requisito >= 24)
- **pnpm:** `11.19.0`
- **Docker Engine:** `28.0.1` (API 1.48, Linux containers)
- **Docker Compose:** `v2.33.1`
- **Supabase CLI:** `2.116.0`
- **PostgreSQL Local:** `PostgreSQL 17.6 (Debian 17.6-1.pgdg130+1)` en contenedor Docker
- **Puertos locales:** Kong `54321`, Postgres `54322`, Auth `9999`
- **Next.js:** `16.3.8` (App Router)
- **Playwright:** `@playwright/test` `1.62.1` (Chromium headless)
- **Vitest:** `v4.1.11`

---

## 2. Inicialización y Migraciones en Supabase Local

Se realizó un reset local determinista sin conexión a producción:

```bash
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --schema public --fail-on error
```

### Migraciones S1 a S4 aplicadas exitosamente:

1. `20261016080000_yalo_s1_direct_booking_preauth.sql` (S1: Direct Booking, pre-auth, slots GiST y locks)
2. `20261016090000_yalo_s2_open_posts_rfq.sql` (S2: Public Needs / RFQ, awards únicos, RPC `list_job_post_offer_cards`)
3. `20261017080000_yalo_s3_delivery_decoupling.sql` (S3: Desacople de entrega presencial/remota, PIN y constancia digital)
4. `20261018080000_yalo_s4_bilateral_money.sql` (S4: Declaraciones bilaterales de dinero externo y revocación de privilegios sensibles)

### Resultado del Linter SQL:

- `npx supabase db lint --local --schema public --fail-on error`: **0 errores** detectados.

---

## 3. Pruebas Unitarias SQL (pgTAP) — 205/205 Assertions PASS

Se ejecutaron las cuatro suites pgTAP oficiales de YALO contra la base local descartable:

| Suite pgTAP                 | Archivo de Test                             | Assertions Esperadas | Assertions Obtenidas |    Estado     |
| --------------------------- | ------------------------------------------- | :------------------: | :------------------: | :-----------: |
| **S1: Direct Booking**      | `supabase/tests/yalo-s1-direct-booking.sql` |          37          |          37          |   **PASS**    |
| **S2: Open Posts / RFQ**    | `supabase/tests/yalo-s2-open-posts.sql`     |          74          |          74          |   **PASS**    |
| **S3: Delivery Decoupling** | `supabase/tests/yalo-s3-delivery.sql`       |          56          |          56          |   **PASS**    |
| **S4: Bilateral Money**     | `supabase/tests/yalo-s4-money.sql`          |          38          |          38          |   **PASS**    |
| **TOTAL pgTAP**             | `yalo-s1..s4`                               |       **205**        |       **205**        | **100% PASS** |

### Correcciones aplicadas durante la validación:

- **S1 (`yalo-s1-direct-booking.sql`):** Persistencia en `provider_booking_slots` con exclusión GiST mediante el trigger `initialize_job_schedule()`, garantizando estado inicial `CONFIRMED`.
- **S2 (`yalo-s2-open-posts.sql`):** Adjudicación concurrente donde el competidor sobre un post adjudicado falla con error `40001` sin corromper el contrato ganador.
- **S3 (`20261017080000_yalo_s3_delivery_decoupling.sql`):** Validación estricta de URL HTTPS para entrega remota y transición bilateral desacoplada (`handover_verified_at` no autocierra sin confirmación del cliente).
- **S4 (`20261018080000_yalo_s4_bilateral_money.sql`):** Cómputo exacto de saldo contractual base y extras, impidiendo pagos duplicados o cobros de terceros no autorizados.

---

## 4. Barrera de Aislamiento para Tests Destructivos (P1 Remediation)

Se implementó el guard fail-closed compartido `packages/config/src/test-safety-guard.ts` con su suite de pruebas unitarias (`packages/config/src/test-safety-guard.test.ts`, 13 tests PASS):

- **Validación de Loopback / Localhost:** Exige explícitamente `127.0.0.1`, `::1` o `localhost` y puerto local esperado (`54322` para PostgreSQL, `54321` para Kong API).
- **Enmascaramiento de Credenciales:** La función `sanitizeConnectionString()` redacta contraseñas y tokens en logs (`postgresql://postgres:***@127.0.0.1:54322/postgres`).
- **Bloqueo de Producción / Staging:** Rechazo fail-closed inmediato ante URLs remotas, hosts no locales (`*.supabase.co`, `krjbpcnjhckqgwlqliyq`), o protocolos TLS inseguros para tests locales.
- **Integración:** El guard se ejecuta como paso previo ineludible en `tests/e2e/yalo-dual-model.spec.ts` (`beforeAll`) y en `apps/web/scripts/yalo-concurrency-runtime.mjs`.

---

## 5. Pruebas de Concurrencia Real Multi-Conexión (C1–C8 Hardened) — 8/8 PASS

Se ejecutó `apps/web/scripts/yalo-concurrency-runtime.mjs` empleando dos conexiones PostgreSQL simultáneas independientes (`PID 47` y `PID 48`):

| #      | Escenario de Concurrencia                                         | Conexiones & Mecanismo                                                                                     | Validación Verificada                                                                                                                              |  Estado  |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | :------: |
| **C1** | Dos clientes reservando simultáneamente el mismo horario          | 2 conexiones paralelas; `EXCLUDE USING gist` en `provider_slot_holds`                                      | Cliente A adquiere el hold; Cliente B recibe violación GiST (`23P01`). Exactamente 1 hold activo                                                   | **PASS** |
| **C2** | Dos prestadores compitiendo por adjudicación en post público      | 2 conexiones en carrera sobre `award_job_post_to_proposal`                                                 | Exactamente 1 ganador (`AWARDED`); el perdedor arroja error `40001` (`post already awarded or no longer open`)                                     | **PASS** |
| **C3** | Persistencia de reservas confirmadas tras 7 días                  | Fila histórica con fecha retroactiva (`NOW() - INTERVAL '8 days'`)                                         | El slot `CONFIRMED` permanece activo (`is_active = true`); nuevo insert en el mismo horario falla con `23P01`; holds expirados se purgan           | **PASS** |
| **C4** | Cancelación, reprogramación y liberación de horario               | Cancelación vía `transition_job_status(..., 'CANCELLED')`                                                  | El slot original se desactiva (`is_active = false`); se reserva exitosamente el mismo horario exacto; se emite evento de auditoría                 | **PASS** |
| **C5** | Carrera de fuerza bruta de PIN entre 2 conexiones simultáneas     | 2 conexiones disparando `verify_job_delivery_pin` en paralelo                                              | Se registran intentos concurrentes; al alcanzar exactamente el umbral de **5 intentos fallidos**, el PIN queda bloqueado (`pin_locked_at` no nulo) | **PASS** |
| **C6** | Carrera entre autocierre por inactividad y corrección del cliente | Carrera atómica entre `auto_complete_stale_jobs()` (`FOR UPDATE SKIP LOCKED`) y `request_job_correction()` | La corrección adquiere el lock de fila, transiciona a `IN_PROGRESS` e invalida el autocierre en carrera sin conflicto                              | **PASS** |
| **C7** | Concurrencia en declaraciones de pago externo e idempotencia      | Dos llamadas concurrentes con misma clave de idempotencia + 2 declaraciones parciales                      | Exactamente 1 registro procesado para la clave duplicada (0 duplicados); declaraciones parciales se asientan sin desbordar el total                | **PASS** |
| **C8** | Seguridad RLS y aislamiento frente a terceros                     | `SET LOCAL ROLE authenticated` y `SET LOCAL ROLE anon` con JWT real (`request.jwt.claim.sub`)              | `anon` denegado con `42501`; tercero no participante denegado con `42501`; propietario autorizado exitosamente                                     | **PASS** |

---

## 6. Pruebas E2E Modulares en Playwright — 4/4 PASS

La suite `tests/e2e/yalo-dual-model.spec.ts` se modularizó en 4 tests independientes ejecutados con Chromium headless:

```bash
npx playwright test tests/e2e/yalo-dual-model.spec.ts --project=chromium --workers=1
# 4 passed (30.8s)
```

| Sub-Test E2E     | Descripción y Flujo                                                       | Rutas Clave                                                              | Tiempo | Capturas Generadas                                                                         |  Estado  |
| ---------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------ | :------: |
| **1. Modelo A1** | Reserva directa preautorizada con slot instantáneo                        | `/p/[slug]/[serviceSlug]`, `/messages/[conversationId]`                  |  2.9s  | `01-model-a1-instant-booking-service.png`<br>`02-model-a1-instant-conversation.png`        | **PASS** |
| **2. Modelo A2** | Contratación negociada y entrega presencial completa con PIN de 4 dígitos | `/p/[slug]/[serviceSlug]`, `/messages/[conversationId]`, `/jobs/[jobId]` | 10.5s  | `03-model-a2-presencial-completed.png`                                                     | **PASS** |
| **3. Modelo B**  | Comparador multi-oferta (2 candidatos) y adjudicación única               | `/needs/new`, `/needs/[postId]`, `/messages/[conversationId]`            |  9.2s  | `04-model-b-comparator-2-offers.png`<br>`05-model-b-awarded-provider2.png`                 | **PASS** |
| **4. Remoto**    | Entrega remota: validación URL HTTPS, corrección y no autocierre          | `/jobs/[jobId]`, `/messages/[conversationId]`                            |  5.3s  | `06-model-b-remote-correction-requested.png`<br>`07-model-b-remote-approved-completed.png` | **PASS** |

- **Errores de consola / red no controlados:** **0** (filtros de handshake WebSocket Realtime local configurados).
- **Capturas de pantalla generadas:** 7 capturas completas en `test-results/yalo-screenshots/`.

---

## 7. Puertas de Calidad (Quality Gates) del Monorepo

| Verificación                   | Comando                                              |             Resultado             | Notas                                                                     |
| ------------------------------ | ---------------------------------------------------- | :-------------------------------: | ------------------------------------------------------------------------- |
| **Typecheck**                  | `pnpm --filter @changas/web typecheck`               |           **0 errores**           | TypeScript estricto validado                                              |
| **Unit / Integration Tests**   | `pnpm test` (Vitest)                                 |    **477 passed (91 suites)**     | 13 nuevos tests para el safety guard                                      |
| **E2E Playwright**             | `npx playwright test tests/e2e/...`                  |        **4 passed (100%)**        | Modelos A1, A2, B y Remoto                                                |
| **Concurrencia Runtime**       | `node apps/web/scripts/yalo-concurrency-runtime.mjs` |       **8/8 passed (100%)**       | PIDs 47 & 48 reales                                                       |
| **Prettier (archivos del PR)** | `npx prettier --check <archivos-pr>`                 |         **100% conforme**         | Archivos del PR formateados                                               |
| **Prettier (deuda repo)**      | `pnpm format:check`                                  | **122 archivos con deuda previa** | Deuda histórica existente en ramas previas (fuera del alcance del PR #29) |

---

## 8. Hallazgos Técnicos y Observaciones para Producción

> [!IMPORTANT]
> **Estado de la Base de Datos Remota:**
>
> - El proyecto en producción contiene 58 migraciones remotas históricas que no tienen archivo de migración en el repositorio Git.
> - Por tanto, las migraciones S1 a S4 (`20261016080000` a `20261018080000`) **NO deben ejecutarse con `supabase db push`** contra producción sin una estrategia previa de reconciliación de esquemas en un entorno de staging idéntico.
> - Se prohíbe terminantemente `supabase db push` o `supabase db reset --linked`.

> [!WARNING]
> **Seguridad de Credenciales:**
>
> - En una sesión anterior se expuso un token de acceso personal (`sbp_fcdd9fb...`). Dicho token **NO** fue utilizado en ningún momento de esta ejecución (todo corrió en local con anon/service_role keys estándar de Docker).
> - Se recomienda al propietario **revocar inmediatamente dicho token** desde el dashboard de Supabase para evitar exposiciones no deseadas.

> [!NOTE]
> **Configuración de Flags en Producción:**
>
> - `CHANGAS_PAYMENTS_ENABLED=false` (Pagos online / Mercado Pago permanecen apagados).
> - `YALO_PUBLIC_NEEDS_ENABLED=false` por defecto en producción hasta que se complete la migración controlada de las tablas S2 en la base de datos remota.

---

## 9. Dictamen Final

- **Objetivo y alcance:** Subsanación rigurosa de las observaciones P1/P2 de la auditoría independiente del PR #29 con Docker/WSL2 según Engineering Standard v1.1.
- **Resultado:** 205/205 pgTAP PASS, 8/8 Concurrencia Multi-Conexión Hardened PASS, 4/4 Playwright E2E Modulares PASS (7 capturas), 477 Vitest PASS, Typecheck 0 errores.
- **Decisión:** **APROBADO CON OBSERVACIONES (LISTO PARA REVISIÓN HUMANA DE CÓDIGO - STOP PRE-MERGE).**
- **Próximo paso:** Revisión del PR #29 en GitHub; no fusionar ni desplegar hasta autorizar el despliegue de base de datos.
