# Phase 05 — Propuestas, aceptación y pagos fake

## Estado final

**Rama:** `codex/phase-05-proposals`  
**Base aprobada de Phase 04:** `ac75a4e9ec71eff9c1b41d0d21e0561768b1c325`  
**Functional HEAD SHA:** `4747b711a9f262d4520c36455442db8d4e90ad94`  
**Final/Approval HEAD SHA:** `ec9a7f6` (con fix de cleanup E2E y plan checklist)  
**CI RUN ID:** `33545442636`  
**validate:** `success`  
**supabase-integration:** `success`  
**Playwright total y resultado:** 34 tests passed (17 Chromium desktop + 17 Pixel 5 mobile-web)  
**pgTAP total:** 17 test files, 274 tests passed  
**Vitest total:** 23 test files, 67 tests passed  
**Lighthouse scores:** Home performance: 93 | Search performance: 91

Phase 05 queda completada, auditada y cerrada de acuerdo con `CHANGAS_MASTER_PLAN.md` (Phase 05, secciones 13, 15 y 21) y `docs/superpowers/plans/2026-09-01-phase-05-proposals.md`. No se implementó el lifecycle de ejecución del trabajo ni proveedor de pagos real (Phase 06/11).

---

## Alcance implementado

1. **Modelo de propuestas estructuradas y versiones inmutables:**
   - Tabla `public.proposals` y tabla `public.proposal_versions`.
   - Tipos de propuesta (`proposal_kind`): `DIRECT_BOOKING`, `QUOTE_REQUEST`, `PROVIDER_QUOTE`, `CLIENT_OFFER`, `COUNTEROFFER`.
   - Estados de propuesta (`proposal_status`): `OPEN`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`, `AWAITING_PAYMENT`, `PAYMENT_FAILED`, `PAID`.
   - Versiones inmutables con trigger estricto `reject_proposal_version_mutation()` que impide cualquier `UPDATE` o `DELETE` sobre `proposal_versions`.
   - Snapshots económicos inmutables: `service_title_snapshot`, `service_description_snapshot`, `modality`, `scope_snapshot`, `price_model_snapshot`, `price_amount`, `currency_code`, `schedule_type`, `expected_duration_minutes`, `includes_snapshot`, `materials_notes_snapshot`.

2. **Reglas de transición y aceptación estricta de contraparte (Counterparty-Only Acceptance):**
   - El autor de los términos actuales NO puede aceptar sus propios términos.
   - El cliente puede aceptar términos escritos por el proveedor (`PROVIDER_QUOTE`, `COUNTEROFFER` de proveedor).
   - El proveedor puede aceptar una oferta escrita por el cliente (`CLIENT_OFFER`, `COUNTEROFFER` de cliente).
   - Un usuario ajeno a la conversación (outsider) no puede listar, crear, revisar, responder ni pagar propuestas.
   - Acciones de respuesta autorizadas: `ACCEPT`, `REJECT`, `WITHDRAW`.
   - Modificaciones de términos generan una nueva versión (`COUNTEROFFER` o `PROVIDER_QUOTE`) incrementando `version_number` y preservando intactas las versiones anteriores.
   - Propuestas vencidas (`expires_at < now()`) transicionan de forma determinística a `EXPIRED` y no pueden ser modificadas ni aceptadas.

3. **Frontera genérica de pagos y arquitectura `PaymentProvider`:**
   - Abstracción genérica `PaymentProvider` en `packages/domain/src/payments.ts` con métodos `createPayment`, `getPaymentStatus`, `refund` y `createAdditionalCharge`.
   - Implementación `FakePaymentProvider` determinística e idempotente para entornos de desarrollo y testing.
   - RPC genérico autoritativo en base de datos: `public.apply_payment_result(...)` en migración `20260901183000_phase_05_payment_provider_boundary.sql`.
   - El RPC genérico es server-only (`SECURITY DEFINER`, ejecutable únicamente por `service_role`, revocado de `anon` y `authenticated`).
   - Recibe `payment_provider_name` (ej. `'FAKE'`), `payment_provider_reference` y `payment_result_status` genéricos (`PENDING`, `SUCCEEDED`, `FAILED`).
   - Utiliza exclusivamente el snapshot de la versión aceptada (`accepted_version`) para el monto y moneda.
   - Crea el registro en `public.jobs` con estado `'CONFIRMED'` única y exclusivamente cuando el estado de pago es `SUCCEEDED`.
   - Es totalmente idempotente ante llamadas duplicadas concurrentes sobre el mismo nonce `(proposal_id, request_nonce)`.
   - Wrapper de testing `apply_fake_payment_result` conservado como capa de compatibilidad sobre el RPC genérico.
   - Restricción de `payment_attempts.provider_name` desacoplada para admitir cualquier nombre de proveedor válido entre 2 y 80 caracteres.

4. **Aislamiento de pagos fake en producción:**
   - `simulateFakeProposalPayment` en `apps/web/src/lib/proposals/server.ts` rechaza inmediatamente cualquier invocación si `process.env.NODE_ENV === "production"`.
   - Los componentes de UI (`ProposalCard`, `ProposalComposer`) ocultan condicionalmente los controles de simulación cuando `NODE_ENV === "production"`.

5. **Cards de propuestas y compositor contextual:**
   - `ProposalCard` y `ProposalComposer` integrados en el hilo de conversación (`/messages/[conversationId]`).
   - Coexistencia armónica con mensajes de texto, adjuntos privados y mensajería en tiempo real.
   - Visualización clara del historial de versiones, estado actual, montos formateados y acciones permitidas según el rol del usuario.

---

## Explícitamente NO implementado (Fuera de alcance)

- Proveedores de pago reales (MercadoPago, Stripe) -> diferido a Phase 11.
- Ciclo de vida y estados de ejecución de trabajo (`IN_PROGRESS`, `COMPLETION_REQUESTED`, `COMPLETED`, disputas, cancelaciones) -> diferido a Phase 06.
- Sistema de reputación, reviews y calificaciones -> diferido a Phase 07.
- Sistema de notificaciones push y webhooks externos de pago -> diferido a Phase 08 / 11.

---

## Migraciones de base de datos (`supabase/migrations/`)

1. `20260901050000_phase_05_proposals.sql`:
   - Enums `proposal_kind`, `proposal_status`, `payment_status`, `job_status`.
   - Tablas `proposals`, `proposal_versions`, `proposal_events`, `payment_attempts`, `jobs`.
   - Trigger `proposal_versions_immutable_guard` con función `reject_proposal_version_mutation()`.
   - Políticas RLS participant-only sobre todas las tablas.
   - RPCs `create_conversation_proposal`, `revise_conversation_proposal`, `respond_to_proposal`, `list_conversation_proposals`.
2. `20260901174500_phase_05_expiry_revision_fix.sql`:
   - Manejo determinístico de propuestas expiradas impidiendo reaperturas o revisiones de versiones vencidas.
3. `20260901183000_phase_05_payment_provider_boundary.sql`:
   - RPC `apply_payment_result` genérico para proveedores de pago externos y wrapper `apply_fake_payment_result`.
   - Flexibilización de constraint en `payment_attempts.provider_name`.

---

## Evidencia de pruebas y verificación automatizada

### Resumen de ejecución en CI (Run `33545442636`)

| Suite de prueba                                    | Cantidad ejecutada      | Resultado             |
| -------------------------------------------------- | ----------------------- | --------------------- |
| **Vitest (Unit tests)**                            | 23 archivos, 67 tests   | **PASS** (100%)       |
| **pgTAP (Database security & RPCs)**               | 17 archivos, 274 tests  | **PASS** (100%)       |
| **Phase 03 Discovery runtime security**            | 1 suite de integración  | **PASS**              |
| **Phase 04 Conversations runtime security**        | 1 suite de integración  | **PASS**              |
| **Phase 05 Proposals & Payments runtime security** | 1 suite de integración  | **PASS**              |
| **Playwright Desktop (Chromium)**                  | 17 tests                | **PASS**              |
| **Playwright Mobile Web (Pixel 5)**                | 17 tests                | **PASS**              |
| **Lighthouse Mobile (Home `/`)**                   | Smoke performance audit | **93** (umbral >= 60) |
| **Lighthouse Mobile (Search `/buscar`)**           | Smoke performance audit | **91** (umbral >= 60) |
| **Lint & Typecheck & Build**                       | Workspace completo      | **PASS**              |

### Pruebas de concurrencia y carreras validadas en runtime

1. **Doble aceptación concurrente:** Dos llamadas simultáneas a `respond_to_proposal` con `ACCEPT` sobre los mismos términos resultan en una única transición legal sin inconsistencias.
2. **Callback de pago duplicado:** Dos llamadas simultáneas a `apply_payment_result` con el mismo nonce generan exactamente un `payment_attempt` y exactamente un `job`.
3. **Inmutabilidad de snapshot:** Ediciones posteriores sobre el título, descripción o precio del servicio en `public.services` no modifican los valores congelados en `proposal_versions`.

---

## Verificación de QA y Browser

El smoke test de Phase 05 (`tests/e2e/phase-05-proposals.spec.ts`) valida de extremo a extremo:

1. Login real de cliente sintético.
2. Navegación a servicio público `demo-proveedor/demo-revision-pc`.
3. Apertura del hilo contextual y click en «Proponer un acuerdo».
4. Creación de propuesta `DIRECT_BOOKING` con alcance descriptivo.
5. Verificación de creación de propuesta, versión `Reserva directa · v1` y estado `Esperando pago`.
6. Confirmación de que los controles de simulación de pago fake no existen en el build de producción.

**Evidencia visual y de layout:**
Ejecutado bajo emulación de viewports móviles (Pixel 5 `393x851`) y Desktop Chromium (`1280x720`) sin desbordamientos horizontales ni colisiones de UI entre el composer de propuestas y el chat.

---

## Limitaciones conocidas

- En esta fase el pago es exclusivamente simulado mediante `FakePaymentProvider` en entornos no productivos.
- El job confirmado permanece en estado inicial `'CONFIRMED'` hasta la implementación del ciclo de vida en Phase 06.

---

## Dictamen final

**PHASE 05 — PASS / APPROVED**

STOP: Fase completada. No iniciar Phase 06.
