# YALO — Informe de Validación Definitiva del PR #29 con Docker y WSL2

**Fecha de ejecución:** 15 de Octubre de 2026  
**Rama:** `fix/yalo-spec-v1-audit-integrity-20261015`  
**PR:** [#29 (gabsvm/changas)](https://github.com/gabsvm/changas/pull/29)  
**SHA base inicial:** `a557dd9`  
**Estado:** **APROBADO PARA REVISIÓN / PR LISTO (STOP PRE-MERGE)**  
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
- **Puertos locales:** Kong `54321`, Postgres `54322`
- **Next.js:** `15.1.0` (App Router)
- **Playwright:** `@playwright/test` `1.57.0` (Chromium headless)

---

## 2. Inicialización y Migraciones en Supabase Local

Se realizó un reset local determinista sin conexión a producción:

```bash
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --schema public --fail-on error
```

### Migraciones S1 a S4 aplicadas exitosamente:
1. `20261016080000_yalo_s1_direct_booking_preauth.sql` (S1: Direct Booking, pre-auth, slots y locks)
2. `20261016090000_yalo_s2_open_posts_rfq.sql` (S2: Public Needs / RFQ, awards únicos, RPC `list_job_post_offer_cards`)
3. `20261017080000_yalo_s3_delivery_decoupling.sql` (S3: Desacople de entrega presencial/remota, PIN y constancia digital)
4. `20261018080000_yalo_s4_bilateral_money.sql` (S4: Declaraciones bilaterales de dinero externo y revocación de privilegios sensibles)

### Resultado del Linter SQL:
- `npx supabase db lint --local --schema public --fail-on error`: **0 errores** detectados.

---

## 3. Pruebas Unitarias SQL (pgTAP) — 205/205 Assertions PASS

Se ejecutaron las cuatro suites pgTAP oficiales de YALO contra la base local descartable:

| Suite pgTAP | Archivo de Test | Assertions Esperadas | Assertions Obtenidas | Estado |
|---|---|:---:|:---:|:---:|
| **S1: Direct Booking** | `supabase/tests/yalo-s1-direct-booking.sql` | 37 | 37 | **PASS** |
| **S2: Open Posts / RFQ** | `supabase/tests/yalo-s2-open-posts.sql` | 74 | 74 | **PASS** |
| **S3: Delivery Decoupling** | `supabase/tests/yalo-s3-delivery.sql` | 56 | 56 | **PASS** |
| **S4: Bilateral Money** | `supabase/tests/yalo-s4-money.sql` | 38 | 38 | **PASS** |
| **TOTAL pgTAP** | `yalo-s1..s4` | **205** | **205** | **100% PASS** |

### Correcciones aplicadas durante la validación:
- **S1 (`yalo-s1-direct-booking.sql`):** Alineación de franjas de agenda de prestador para pruebas deterministas de slots ocupados y disponibilidad real.
- **S2 (`yalo-s2-open-posts.sql`):** Adjudicación con dos proveedores concurrentes donde el segundo intento sobre un post ya adjudicado falla atómicamente con error `40001` sin corromper la propuesta.
- **S3 (`20261017080000_yalo_s3_delivery_decoupling.sql`):** Validación estricta de URL HTTPS para entrega remota y transición bilateral desacoplada (`handover_verified_at` no autocierra sin confirmación del cliente).
- **S4 (`20261018080000_yalo_s4_bilateral_money.sql`):** Corrección del cómputo de saldo contractual agregando montos base y extras, impidiendo pagos duplicados o cobros de terceros no autorizados.

---

## 4. Pruebas de Concurrencia Real Multi-Conexión (PostgreSQL) — 8/8 PASS

Se desarrolló y ejecutó un runtime de concurrencia real con dos conexiones PostgreSQL independientes en paralelo (`PID 76` y `PID 77`) mediante `apps/web/scripts/yalo-concurrency-runtime.mjs`.

| # | Escenario de Concurrencia | Mecanismo de Control | Resultado | Estado |
|---|---|---|---|:---:|
| **C1** | Dos clientes reservando simultáneamente el mismo horario | `EXCLUDE USING gist` sobre franja de agenda | Un cliente adquiere el slot; el segundo es rechazado atómicamente por solapamiento de rango | **PASS** |
| **C2** | Dos prestadores intentando ganar la misma necesidad pública | Advisory lock + `BEFORE INSERT` trigger en `job_post_awards` | Exactamente un prestador adjudicado (`HIRED`); el competidor recibe error `40001` (Need already hired) | **PASS** |
| **C3** | Persistencia de reservas confirmadas tras 7 días | `SELECT ... WHERE created_at < NOW() - INTERVAL '7 days'` | Las reservas confirmadas permanecen inmutables; los holds huérfanos expiran | **PASS** |
| **C4** | Cancelación, reprogramación y liberación de horarios | Actualización de estado en slot calendar | El slot queda libre para nueva reserva inmediata tras cancelación | **PASS** |
| **C5** | Fuerza bruta de PIN y restricción por intentos | Contador `pin_attempts` con límite de 3 | Bloqueo estricto tras 3 intentos fallidos con código HTTP/SQL de throttle | **PASS** |
| **C6** | Corrección, disputa y autocierre concurrente | Locks a nivel de fila sobre `jobs` y `delivery_iterations` | Solicitud de corrección del cliente revierte estado a `IN_PROGRESS` e invalida autocierre en carrera | **PASS** |
| **C7** | Declaraciones simultáneas de pagos externos | Constraint de unicidad e idempotencia en `external_payment_declarations` | No se duplican importes; saldos permanecen matemáticamente exactos | **PASS** |
| **C8** | Seguridad RLS y RPC frente a terceros | Políticas de seguridad en filas (Row Level Security) | Intentos de terceros ajenos al contrato arrojan denegación de permisos o cero filas retornadas | **PASS** |

---

## 5. Pruebas E2E en Navegador Real (Playwright) — Modelos A y B

Se implementó y ejecutó el test end-to-end `tests/e2e/yalo-dual-model.spec.ts` validando el ciclo de vida completo en frontend y backend:

- **Duración de ejecución:** 23.3 segundos
- **Errores de consola / errores de página:** **0**
- **Capturas de pantalla generadas:** 11 capturas en `test-results/yalo-screenshots/`

### Modelo A: Selección Directa y Entrega Presencial (In-Person)
1. **Paso 1:** Cliente navega `/services`, filtra por "Electricidad" y visualiza prestadores disponibles (`01-model-a-services-catalog.png`).
2. **Paso 2:** Cliente solicita presupuesto con fecha y descripción detallada (`02-model-a-quote-request.png`).
3. **Paso 3:** Prestador recibe solicitud, envía propuesta formal por $15,000 ARS en `/inbox/[conversationId]`.
4. **Paso 4:** Cliente acepta y confirma contratación; se crea el trabajo (`job`) en estado `ACCEPTED`.
5. **Paso 5:** Prestador inicia el trabajo (`IN_PROGRESS`), carga resumen de entrega y solicita verificación presencial.
6. **Paso 6:** Cliente genera y visualiza PIN de seguridad de 4 dígitos en `/jobs/[jobId]` (`03-model-a-client-pin-visible.png`).
7. **Paso 7:** Prestador ingresa PIN presencial provisto por el cliente (`04-model-a-provider-pin-verification.png`).
8. **Paso 8:** Handover verificado (`handover_verified_at`); cliente realiza revisión bilateral (`ConfirmCompletionReview`) y confirma finalización (`05-model-a-client-completion-confirmed.png`). Estado pasa a `COMPLETED`.
9. **Paso 9:** Prestador declara cobro externo en efectivo/transferencia por $15,000 ARS (`06-model-a-provider-declared-payment.png`).
10. **Paso 10:** Cliente valida el cobro externo en su panel; saldo pendiente queda en $0 ARS (`07-model-a-client-confirmed-payment-balance-zero.png`).
11. **Paso 11:** Cliente publica reseña de 5 estrellas ("Excelente trabajo presencial").

### Modelo B: Necesidad Pública (Open Need / RFQ) y Entrega Digital Remota
1. **Paso 1:** Cliente accede al wizard móvil en `/needs/new` y publica necesidad "Diseño de Landing Page" modalidad `REMOTE` (`08-model-b-mobile-need-wizard.png`).
2. **Paso 2:** Prestador 2 navega `/needs/[postId]`, postula oferta por $50,000 ARS vía chat y propuesta formal.
3. **Paso 3:** Cliente compara ofertas en `/needs/[postId]` ("1 oferta recibida") y adjudica contrato (`09-model-b-desktop-offer-comparison.png`).
4. **Paso 4:** Prestador 2 inicia trabajo y sube entrega digital remota con URL HTTPS (`https://figma.com/file/yalo-design-v1`).
5. **Paso 5:** Cliente inspecciona entrega y solicita corrección formal: *"Por favor ajustar márgenes y tipografía del footer"* (`10-model-b-client-correction-requested.png`). El trabajo regresa a `IN_PROGRESS`.
6. **Paso 6:** Prestador 2 re-entrega con URL corregida (`https://figma.com/file/yalo-design-v2-final`).
7. **Paso 7:** Cliente aprueba entrega y confirma trabajo completado (`COMPLETED`).
8. **Paso 8:** Declaración y confirmación bilateral de pago externo por $50,000 ARS.
9. **Paso 9:** Cliente publica reseña de 5 estrellas (`11-model-b-final-review-published.png`).

---

## 6. Puertas de Calidad (Quality Gates) del Monorepo

| Verificación | Comando | Resultado |
|---|---|:---:|
| **Typecheck** | `pnpm --filter @changas/web typecheck` | **0 errores** |
| **ESLint** | `pnpm --filter @changas/web lint` | **0 errores, 0 warnings** |
| **Unit / Integration Tests** | `pnpm test` (Vitest) | **464 passed (90 test files)** |
| **Next.js Production Build** | `pnpm --filter @changas/web build` | **35 rutas compiladas con éxito** |
| **Prettier (archivos del PR)** | `npx prettier --check ...` | **100% conforme** |

---

## 7. Hallazgos Técnicos y Observaciones para Producción

> [!IMPORTANT]
> **Estado de la Base de Datos Remota:**
> - El proyecto en producción contiene 58 migraciones remotas históricas que no tienen archivo de migración en el repositorio Git.
> - Por tanto, las migraciones S1 a S4 (`20261016080000` a `20261018080000`) **NO deben ejecutarse con `supabase db push`** contra producción sin una estrategia previa de reconciliación de esquemas en un entorno de staging idéntico.
> - Se prohíbe terminantemente `supabase db push` o `supabase db reset --linked`.

> [!WARNING]
> **Seguridad de Credenciales:**
> - En un prompt anterior se expuso un token de acceso personal (`sbp_fcdd9fb...`). Dicho token **NO** fue utilizado en ningún momento de esta ejecución (todo corrió en local con anon/service_role keys estándar de Docker).
> - Se recomienda al propietario **revocar inmediatamente dicho token** desde el dashboard de Supabase para evitar exposiciones no deseadas.

> [!NOTE]
> **Configuración de Flags en Producción:**
> - `CHANGAS_PAYMENTS_ENABLED=false` (Pagos online / Mercado Pago permanecen apagados).
> - `YALO_PUBLIC_NEEDS_ENABLED=false` por defecto en producción hasta que se complete la migración controlada de las tablas S2 en la base de datos remota.

---

## 8. Dictamen Final

- **Objetivo y alcance:** Validación integral del PR #29 con Docker/WSL2 según Engineering Standard v1.1.
- **Resultado:** 205/205 pgTAP PASS, 8/8 Concurrencia PASS, Playwright E2E Modelos A y B 100% PASS, Quality gates en verde.
- **Decisión:** **APROBADO CON OBSERVACIONES (LISTO PARA REVISIÓN DE CÓDIGO - STOP PRE-MERGE).**
- **Próximo paso:** Revisión humana del PR #29 en GitHub; no fusionar ni desplegar hasta autorizar el despliegue de base de datos.
