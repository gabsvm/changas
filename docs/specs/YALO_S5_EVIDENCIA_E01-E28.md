# YALO S5 — Evidencia E01–E28 y endurecimiento

Rama: `yalo/s5-qa-endurecimiento` sobre `main` 230a5cd (S4 mergeado, PR #27).
Convenciones: **PASS-unit** = vitest local verde en esta rama; **CONTRATO** =
pgTAP redactado con plan verificado, ejecución en CI pendiente
(`supabase-integration` corre solo con backend; sin docker local);
**EXCEPCIÓN** = requiere entorno con cuentas/datos o dispositivo real.

## Gate E01–E28

| E   | Veredicto | Evidencia                                                                                                                                                                                                                                                                                                                               |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | EXCEPCIÓN | Requiere login real con cuentas; sin entorno con seed.                                                                                                                                                                                                                                                                                  |
| E02 | CONTRATO  | `yalo-s1-direct-booking.sql` plan 35: reserva crea 1 job + 1 hold.                                                                                                                                                                                                                                                                      |
| E03 | CONTRATO  | `yalo-s1-direct-booking.sql` plan 35: sin reserva queda solicitud, no job.                                                                                                                                                                                                                                                              |
| E04 | CONTRATO  | S1 + `phase-04-conversations.sql`: solicitud, chat 1:1 y cotización.                                                                                                                                                                                                                                                                    |
| E05 | CONTRATO  | `phase-05-proposals.sql` + S1: versiones, motivos, expiración, retiro.                                                                                                                                                                                                                                                                  |
| E06 | CONTRATO  | S1 idempotencia + S2: doble aceptación da como máximo 1 job.                                                                                                                                                                                                                                                                            |
| E07 | CONTRATO  | `yalo-s2-open-posts.sql` plan 69: 3 ofertas privadas comparables.                                                                                                                                                                                                                                                                       |
| E08 | CONTRATO  | S2 plan 69: doble award simultáneo deja 1 award y 1 job.                                                                                                                                                                                                                                                                                |
| E09 | CONTRATO  | `phase-09-trust-safety.sql` + `phase-10-identity-submission.sql`: RPC/RLS rechaza suspendidos.                                                                                                                                                                                                                                          |
| E10 | CONTRATO  | RPCs reschedule + `job-lifecycle-hardening.sql` plan 70: sin solape, original conservado.                                                                                                                                                                                                                                               |
| E11 | PASS-unit | `payments/server.test.ts`: adicional sale del snapshot aceptado, nunca de montos del llamante; con pagos OFF las actions de checkout lanzan.                                                                                                                                                                                            |
| E12 | CONTRATO  | `yalo-s3-delivery.sql` plan 51: PIN retenido permite corrección/disputa, sin cierre unilateral.                                                                                                                                                                                                                                         |
| E13 | CONTRATO  | `job-confirmation-code.sql` plan 10: bloqueo tras 5 errores, sexto válido en ventana.                                                                                                                                                                                                                                                   |
| E14 | CONTRATO  | S3 plan 51: entrega remota se revisa/aprueba/corrige sin PIN.                                                                                                                                                                                                                                                                           |
| E15 | CONTRATO  | `job-lifecycle-hardening.sql` plan 70: autocierre con lock no pisa disputa/corrección.                                                                                                                                                                                                                                                  |
| E16 | PASS-unit | `job-tracker.test.ts`: sin nada que pagar salta a reseña; monto acordado visible sin «Pagado».                                                                                                                                                                                                                                          |
| E17 | CONTRATO  | `yalo-s4-money.sql` plan 34: declaración queda pendiente, sin acreditación automática.                                                                                                                                                                                                                                                  |
| E18 | CONTRATO  | S4 plan 34: confirmación de contraparte, audit log y saldo.                                                                                                                                                                                                                                                                             |
| E19 | CONTRATO  | S4 plan 34: contestación con motivo, sin «verificado por YALO».                                                                                                                                                                                                                                                                         |
| E20 | CONTRATO  | S4 plan 34: tope con parciales (60+50 sobre 100 rechazado) e idempotencia por clave.                                                                                                                                                                                                                                                    |
| E21 | PASS-unit | Nuevo en S5: `payments/server.test.ts` 22/22 — checkout online excluye lo confirmado bilateral (140−40=100, fee 10k) y rechaza con CONFLICT si cubre el total. Acción `startJobSettlementCheckoutAction` ya exigía pagos ON. Nota de revisión: un resto de 1 minor generaría checkout; sin piso mínimo por ahora (SPEC 7.3 no lo pide). |
| E22 | EXCEPCIÓN | Requiere dos cuentas en la misma PWA instalada; sin entorno con seed.                                                                                                                                                                                                                                                                   |
| E23 | CONTRATO  | `yalo-b3-job-filters-unread.sql` plan 12: filtros server-side, cursors y unread.                                                                                                                                                                                                                                                        |
| E24 | EXCEPCIÓN | Caminos de ayuda manuales; sin usuarios de prueba.                                                                                                                                                                                                                                                                                      |
| E25 | EXCEPCIÓN | Requiere móvil 360/390/412 + dark/light/zoom; el dueño revisa en el deploy preview.                                                                                                                                                                                                                                                     |
| E26 | CONTRATO  | Suites `phase-*-rls/grants` + S1–S4: anon/ajenos no adjudican, cierran ni confirman.                                                                                                                                                                                                                                                    |
| E27 | PASS-unit | `guided.test.ts`: con pagos OFF no hay «Ir a pagar»; push reales, EXCEPCIÓN (sin pagos reales por norma).                                                                                                                                                                                                                               |
| E28 | EXCEPCIÓN | CTA del paso 4 corregido en S0; verificación del flujo completo, manual.                                                                                                                                                                                                                                                                |

## Endurecimiento incluido en S5

- **E21/SPEC 7.3**: `createJobSettlementCheckout` excluye lo confirmado
  bilateral y rechaza con CONFLICT si cubre el total
  (`apps/web/src/lib/payments/server.ts` + 2 tests). Sin migraciones
  productivas; sin `supabase db push`; pagos online siguen OFF.
- **Scripts runtime** (`apps/web/scripts/phase-*-runtime.mjs`): las 20 RPC
  troncales que usan existen en `supabase/migrations` (S1–S4 solo agrega;
  ninguna renombrada). La ejecución viva requiere backend con seed:
  EXCEPCIÓN.
- **PWA/marca**: manifest YALO con tokens de marca (`#0D121B`, `#F6F9FC`),
  iconos 192/512 + maskable, `sw.js`, sin `purple/indigo/violet/fuchsia`
  en `src`. Screenshots del manifest (12/10) pre-rebrand: regenerar con UI
  real cuando haya entorno con seed.

## Pendiente explícito

- Ejecución pgTAP en CI (`supabase-integration` salteado mientras
  `validate` siga rojo por `format:check` preexistente repo-wide).
- Capturas móvil claro/oscuro y E-verificaciones marcadas EXCEPCIÓN.
