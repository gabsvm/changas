# Phase 06 — Jobs

## Estado final

**Fase:** Phase 06 — Jobs  
**Rama:** `codex/phase-06-jobs`  
**Base canónica aprobada (Phase 05):** `4ef03e67041fa80eb80a490adff5eeae17b8f9e9`  
**Functional HEAD SHA:** `3e2639d4ac1baac57c46e36a37329cca8c3afcf5`  
**Final/Approval HEAD SHA:** (será confirmado en commit final)  
**CI RUN ID:** `33578349764`  
**validate:** `success`  
**supabase-integration:** `success`  
**Playwright total y resultado:** 36 tests passed (18 Desktop Chromium + 18 Pixel 5 mobile-web)  
**pgTAP total:** 20 test files, 316 tests passed  
**Vitest total:** 26 test files, 72 tests passed  
**Lighthouse mobile scores:** Home performance: 85 | Search performance: 91

Phase 06 queda formalmente completada, verificada y auditada de acuerdo con `CHANGAS_MASTER_PLAN.md` (Phase 06, §14, §15, §21) y `docs/superpowers/plans/2026-09-01-phase-06-jobs.md`. No se adelantaron funcionalidades de Phase 07 (reviews/reputación) ni proveedores de pago reales (Phase 11).

---

## 1. Alcance implementado (Scope delivered)

1. **Modelo de agenda y 4 estructuras de programación:**
   - Tipos de agenda (`schedule_type`): `FIXED_SLOT`, `FLEXIBLE_WINDOW`, `DEADLINE`, `UNSCHEDULED`.
   - Historial inmutable de versiones de agenda (`job_schedule_versions`) con puntero al schedule actual en `jobs.current_schedule_version_id`.
   - Solicitudes estructuradas de reprogramación (`job_reschedule_requests`) con estados `OPEN`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` y registro de autor y motivo.

2. **Disponibilidad recurrente, excepciones y reservas temporales (Holds):**
   - Reglas recurrentes de disponibilidad (`availability_rules`) por día de semana, hora local y zona horaria.
   - Bloques de excepción/indisponibilidad personal (`availability_blocks`).
   - Bloqueos temporales de cupo (`provider_slot_holds`) durante el flujo de pago con expiración automática.
   - Revalidación transaccional con advisory locks por proveedor (`pg_advisory_xact_lock`) y exclusión estricta (`provider_booking_slots`) para prevenir double booking.

3. **Máquina de estados del trabajo (Job lifecycle):**
   - Estados: `CONFIRMED`, `IN_PROGRESS`, `COMPLETION_REQUESTED`, `COMPLETED`, `CANCELLED`, `DISPUTED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `EXPIRED`, `NO_SHOW`.
   - Transiciones legales restringidas por rol:
     - Inicio de trabajo (`IN_PROGRESS`) y solicitud de finalización (`COMPLETION_REQUESTED`) exclusivos del proveedor.
     - Confirmación de finalización (`COMPLETED`) exclusiva del cliente.
     - Cancelación (`CANCELLED`) y reporte de no-show (`NO_SHOW`) con persistencia auditable de actor y motivo (`job_events`).
     - Liberación de cupos de agenda en estados terminales (`provider_booking_slots.is_active = false`).

4. **Cambios de alcance (Scope changes) y pagos adicionales:**
   - Propuesta estructurada de cambio de alcance (`job_scope_changes`) solicitada por el proveedor.
   - Aceptación obligatoria del cliente para cualquier modificación.
   - Desglose auditable y explícito en UI/modelo: Total actual, Adicional, Nuevo total.
   - Si incluye monto adicional, transiciona por `AWAITING_PAYMENT` y requiere pago adicional exitoso.
   - Frontera genérica de pago adicional server-only (`apply_additional_payment_result`) desacoplada de proveedores específicos, con adapter de desarrollo `FakePaymentProvider` e idempotencia por nonce.

5. **Privacidad estricta de ubicación:**
   - Ubicaciones privadas (`job_private_locations`) aisladas con RLS y RPCs autoritativos.
   - Trabajos en modalidad `REMOTE` no almacenan ni exponen direcciones exactas bajo ninguna circunstancia.
   - Acceso a dirección exacta restringido exclusivamente al proveedor participante durante la ejecución activa de trabajos presenciales confirmados. Tras la finalización (`COMPLETED`), el acceso por read model queda revocado.

6. **Interfaz de usuario y vistas de trabajos:**
   - Bandeja de trabajos (`/jobs`) con vista de próximos trabajos.
   - Detalle inmutable del trabajo (`/jobs/[jobId]`) con snapshot contractual congelado, cronología de eventos, agenda, acciones permitidas por rol y aislamiento de controles de pago fake en entornos de producción.
   - Adaptabilidad móvil completa sin desbordamiento horizontal (`overflow-x`).

---

## 2. Archivos y migraciones principales

### Migraciones de base de datos (`supabase/migrations/`)

1. `20260901150000_phase_06_jobs.sql`: Esquema base de jobs, enums de estado, schedule versions, eventos, reschedule requests y RLS.
2. `20260901151000_phase_06_job_read_models.sql`: Funciones RPC de lectura segura `get_job_detail` y `list_upcoming_jobs`.
3. `20260901190000_phase_06_availability_holds.sql`: Disponibilidad recurrente, excepciones, holds temporales y tabla `provider_booking_slots`.
4. `20260901190500_phase_06_availability_compat.sql`: Compatibilidad de constraints para timezone y periodos.
5. `20260901191000_phase_06_additional_payment_boundary.sql`: RPC server-only genérico `apply_additional_payment_result` para cambios de alcance.
6. `20260901191500_phase_06_job_profile_join_fix.sql`: Ajuste en join de perfiles para contraparte en vistas de trabajo.
7. `20260901192000_phase_06_transactional_scheduling.sql`: Revalidación transaccional con advisory locks para creación y reprogramación de slots.
8. `20260901192500_phase_06_remote_location_write_guard.sql`: Guardia de escritura que rechaza ubicaciones privadas para trabajos remotos.
9. `20260901193000_phase_06_remote_location_read_guard.sql`: Guardia RLS y de lectura que previene fugas de dirección en servicios remotos.
10. `20260901193500_phase_06_payment_hold_outcomes.sql`: Manejo de holds en pagos: retención en `PENDING`, liberación en `FAILED` (`PAYMENT_SLOT_RELEASED`), consumo en `SUCCEEDED` (`PAYMENT_SLOT_CONSUMED`).

### Código TypeScript de dominio y aplicación

- `packages/domain/src/jobs.ts` & `packages/domain/src/jobs.test.ts`
- `packages/domain/src/payments.ts` & `packages/domain/src/payments.test.ts`
- `apps/web/src/lib/jobs/server.ts` & `apps/web/src/lib/jobs/server.test.ts`
- `apps/web/src/lib/proposals/server-payment-flow.test.ts`
- `apps/web/src/app/(account)/jobs/page.tsx`
- `apps/web/src/app/(account)/jobs/[jobId]/page.tsx`
- `apps/web/src/app/(account)/jobs/actions.ts`

---

## 3. Modelo de seguridad y RLS

- **Políticas RLS:** Acceso restringido exclusivamente a participantes del trabajo (`client_user_id` o `provider_user_id`). Lecturas denegadas para usuarios ajenos (outsiders).
- **Autoridad RPC:** Todas las transiciones de estado, bloqueos de cupo, cambios de agenda y pagos son ejecutadas mediante funciones `SECURITY DEFINER` con `search_path = pg_catalog, public`.
- **Fronteras `service_role`:** `apply_payment_result` y `apply_additional_payment_result` son server-only y no pueden ser ejecutadas directamente por roles autenticados (`authenticated`).
- **Aislamiento de pagos fake en producción:** Métodos de simulación y controles UI quedan inhabilitados en `NODE_ENV === "production"`.

---

## 4. Garantías de agenda y prevención de colisiones

- **Exclusión física:** Constraint GiST en `provider_booking_slots` impide dos reservas activas superpuestas para el mismo proveedor.
- **Advisory Locks:** Bloqueo transaccional exclusivo `pg_advisory_xact_lock(hashtext('provider_scheduling:' || provider_id))` durante la creación y reprogramación.
- **Holds temporales:** Intervalos en proceso de pago quedan reservados con expiración determinística. Un intento concurrente sobre el mismo intervalo es rechazado inmediatamente.

---

## 5. Evidencia de pruebas y TDD

### TDD RED → GREEN documentado

1. **Flujo de pago sin hold:** `server-payment-flow.test.ts` fallaba inicialmente (RED) al no reservar el hold antes del pago fake; resuelto con integración de `hold_proposal_slot` previo al adapter (GREEN).
2. **Fuga de dirección en trabajos remotos:** `phase-06-location-runtime.mjs` detectó lectura indebida (RED); resuelto con migración `20260901193000_phase_06_remote_location_read_guard.sql` (GREEN).
3. **Liberación de hold en pago fallido:** `phase-06-scheduling-runtime.mjs` detectó que un pago fallido retenía el hold (RED); resuelto con migración `20260901193500_phase_06_payment_hold_outcomes.sql` emitiendo `PAYMENT_SLOT_RELEASED` (GREEN).

### Métricas de CI y verificación final

| Suite de prueba                                    | Cantidad ejecutada      | Resultado             |
| -------------------------------------------------- | ----------------------- | --------------------- |
| **Vitest (Unit tests)**                            | 26 archivos, 72 tests   | **PASS** (100%)       |
| **pgTAP (Database security & RPCs)**               | 20 archivos, 316 tests  | **PASS** (100%)       |
| **Phase 03 Discovery runtime security**            | 1 suite de integración  | **PASS**              |
| **Phase 04 Conversations runtime security**        | 1 suite de integración  | **PASS**              |
| **Phase 05 Proposals & Payments runtime security** | 1 suite de integración  | **PASS**              |
| **Phase 06 Scheduling/hold runtime security**      | 1 suite de integración  | **PASS**              |
| **Phase 06 Transactional scheduling integrity**    | 1 suite de integración  | **PASS**              |
| **Phase 06 Exact-location runtime security**       | 1 suite de integración  | **PASS**              |
| **Phase 06 Jobs runtime security**                 | 1 suite de integración  | **PASS**              |
| **Playwright Desktop (Chromium)**                  | 18 tests                | **PASS**              |
| **Playwright Mobile Web (Pixel 5)**                | 18 tests                | **PASS**              |
| **Lighthouse Mobile (Home `/`)**                   | Smoke performance audit | **85** (umbral >= 60) |
| **Lighthouse Mobile (Search `/buscar`)**           | Smoke performance audit | **91** (umbral >= 60) |
| **Lint & Typecheck & Build**                       | Workspace completo      | **PASS**              |

---

## 6. Lista de verificación de aceptación (Acceptance Checklist)

- [x] Double booking prevenido a nivel de base de datos.
- [x] Transiciones de estado ilegales fallan en el servidor.
- [x] Términos aceptados del Job son inmutables y auditables.
- [x] Versiones de agenda preservan el historial de reprogramaciones.
- [x] Cambio de alcance no puede aumentar el precio sin aceptación del cliente.
- [x] Precio adicional requiere pago adicional exitoso.
- [x] Cancelación y No-show registran actor y motivo.
- [x] Booking slot es liberado en estados terminales.
- [x] Holds temporales previenen condiciones de carrera en pagos.
- [x] Disponibilidad es revalidada transaccionalmente.
- [x] Pago PENDING conserva hold, FAILED lo libera, SUCCEEDED lo consume.
- [x] Dirección exacta privada no se expone arbitrariamente.
- [x] Trabajos remotos no almacenan ni exponen dirección exacta.
- [x] Controles de pago fake no están disponibles en producción.
- [x] Permisos de cliente y proveedor se hacen cumplir server-side.
- [x] Vistas de próximos trabajos (`/jobs` y `/jobs/[jobId]`) funcionan correctamente.
- [x] UI desktop y móvil sin desbordamiento horizontal (`overflow-x`).

---

## 7. Trabajo diferido explícitamente (Known Deferred Work)

- **Phase 07:** Sistema de reseñas, reputación y métricas de completitud.
- **Phase 08:** Notificaciones push, emails transaccionales y webhooks de eventos.
- **Phase 11:** Integración con proveedores de pago reales (MercadoPago / Stripe) y conciliación contable.

---

## Dictamen final

**PHASE 06 — PASS / APPROVED**

STOP: Phase 06 completada. No iniciar Phase 07.
