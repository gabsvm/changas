# YALO — Auditoría independiente del SPEC funcional v1.0

**Fecha:** 14/10/2026 (Argentina; verificación nocturna)  
**Repositorio:** https://github.com/gabsvm/changas  
**Código analizado:** `main` SHA `30955973ca47ddef0a09b5aeb7ae14d79c3c5d05`, merge PR #28.  
**Base comparada:** `14b413a1e2e50a33e246c186645322b4deff27f2` — 21 commits, 56 archivos modificados/agregados.  
**Vercel:** deployment `dpl_J4ikVGRD16PsuPdTNnJEfwHtgSyx` — `READY`, mismo SHA.  
**Supabase:** proyecto `krjbpcnjhckqgwlqliyq`, consultado DIRECTAMENTE en modo solo lectura.  
**Criterio de producto:** SPEC v1.0 aprobado: doble captación A/B; contratación instantánea preautorizada o negociada; PIN presencial / evidencia digital remota; cobros externos declarados y confirmados bilateralmente; pagos Mercado Pago OFF; sin exigir GitHub Actions.  
**Tipo de auditoría:** estática de código + verificación directa del historial/esquema Supabase + estado de despliegue y clusters de errores. **No** incluye prueba E2E de dos cuentas autenticadas ni ejecución de pgTAP.

## Veredicto ejecutivo

**NO APTO para declarar IMPLEMENTADO E2E / NO aplicar las migraciones de S1–S4 tal como están.** Muse produjo una cantidad significativa de código, pero el frontend fue promovido sin su backend; además, las propias migraciones contienen fallos de integridad y permisos. Se requiere una corrección deliberada y un despliegue coordinado, con pruebas de ambos roles en staging, antes de abrir la función al público.

No se debe interpretar `READY` de Vercel como prueba de circuitos funcionales. **No habilitar Mercado Pago** para resolver este desfase: no corresponde a la decisión de producto.

## 1. Estado realmente desplegado: diferencia decisiva entre GitHub y DB

El historial `supabase_migrations.schema_migrations` NO contiene:

| Migración nueva | Función | En main | Aplicada en DB |
|---|---|---:|---:|
| `20261016080000_yalo_s1_direct_booking_preauth.sql` | Preautorización reserva directa | Sí | **NO** |
| `20261016090000_yalo_s2_open_posts.sql` | Necesidades abiertas/ofertas | Sí | **NO** |
| `20261017080000_yalo_s3_delivery_decoupling.sql` | Entrega multimodal y correcciones | Sí | **NO** |
| `20261018080000_yalo_s4_bilateral_money.sql` | Declaraciones de pagos externos | Sí | **NO** |

Confirmaciones directas de esquema:
- No existe `services.instant_booking_enabled`.
- No existe `conversations.job_post_id`.
- No existe `jobs.delivery_submitted_at`.
- No existen RPC `create_job_post`, `submit_job_delivery`, `declare_external_payment`, `request_job_correction` o `start_post_offer_conversation` (0 funciones encontradas de esas cinco).
- No existe tabla `external_payment_declarations` ni `job_posts`.
- DB `payments_online=false` y servicio `btree_gist` instalado.
- Al consultar había **0** trabajos `IN_PROGRESS`, **4** `COMPLETED`, **0** holds activos y **0** holds activos solapados (datos puntuales del momento; no es un estado permanente).

Implicaciones directas para producción:
- En ficha con precio fijo, el código muestra «Solicitar contratación» si la columna nueva no existe y selecciona `DIRECT_BOOKING` de todos modos. El RPC **antiguo** aún instalado en DB acepta una propuesta `DIRECT_BOOKING` con precio fijo y crea un `Job CONFIRMED` inmediatamente **sin autorización previa del prestador**. **P0 productivo**: la interfaz y la política de contratación se contradicen.
- `/needs` y `/oportunidades` ejecutan consultas a `job_posts`, tabla no existente; la nueva publicación no funciona.
- Un prestador en `IN_PROGRESS` ve «Enviar entrega» y llama a `submit_job_delivery`, RPC inexistente. La ruta UI nueva de finalización queda bloqueada hasta desplegar S3 o restaurar compatibilidad.
- Un trabajo `COMPLETED` con pagos online OFF llama a `getExternalMoney`. Este método intenta RPC y tabla inexistentes; la ruta supuestamente tolerante puede no degradar: ambos errores se convierten mediante `mapMoneyError` en `JobServerError` y el detector `isMissingExternalMoneySchema` comprueba **los códigos PostgREST originales** o cadenas de mensaje que ya pueden haberse perdido. Revisar en staging con un job completado. Riesgo de excepción al abrir el detalle, aunque los clusters Vercel todavía no muestran errores nuevos específicos desde el deploy.

**No ejecutar `supabase db push`**: el proyecto tiene historial remoto de migraciones antiguas ausentes de checkout/repo. Usar plan SQL/rollback manual verificado con DBA y comparación de firmas de las funciones a reemplazar.

## 2. Hallazgos priorizados del código S1–S4

### P0-01 · S2 no migra: índice antes que columna

**Evidencia:** `supabase/migrations/20261016090000_yalo_s2_open_posts.sql`:
- aprox. línea 39: `create index ... on public.conversations (job_post_id)`;
- aprox. línea 56: `alter table public.conversations add column if not exists job_post_id uuid`.

La columna no está en producción. Una aplicación de esta migración como está fallará al crear el índice antes de crear la columna. **Fix:** invertir orden, probar clean migration sobre un clon, realizar rollback de prueba. Corregir antes de desplegar S2.

### P0-02 · La solicitud pública no garantiza un solo ganador (E08 falsamente sobreafirmado)

**Evidencia:** `supabase/migrations/20261016090000_yalo_s2_open_posts.sql`, `close_job_post_on_hire()` ~línea 63: trigger `AFTER INSERT ON jobs` hace `update job_posts set status='HIRED' where status in ('OPEN','PAUSED')`, pero **no genera error si ya estaba HIRED/CLOSED**; tampoco hay índice único de `jobs` por `job_post_id` o `request_award`, ni `respond_to_proposal` comprueba de manera transaccional el estado del post. Dos conversaciones de distintos proveedores pueden llevar a dos propuestas aceptadas y dos jobs ligados a UNA necesidad.

El test `supabase/tests/yalo-s2-open-posts.sql` verifica **solo una aceptación** que pasa a HIRED; no reproduce segunda aceptación ni carrera. El reporte S5 etiqueta E08 `CONTRATO`, no ejecución PASS. **Fix:** adjudicación con claim transaccional de la solicitud/slot bajo lock y constraint único real por plaza, coordinado con la creación de Job; una aceptación posterior debe ser rechazada antes del INSERT, tanto en secuencia como bajo concurrencia. Rechazar contratos si post está HIRED/CLOSED/PAUSED según política. Suite dos proveedores y doble sesión.

### P0-03 · Producción conserva autocontratación fija antigua

**Evidencia:** `apps/web/src/lib/ui/direct-booking.ts` selecciona `DIRECT_BOOKING` cuando precio fijo; `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx` etiqueta «Solicitar contratación» cuando `instant_booking_enabled` no está en la vista; `supabase/migrations/20261010000000_hire_on_accept.sql` antiguo `DIRECT_BOOKING` siempre asigna `ACCEPTED` y genera `Job CONFIRMED`. Nueva comprobación de flag llega solo con S1, no aplicada.

**Fix inmediato:** bloquear reserva directa o hacer que el backend y los formularios generen flujo pendiente hasta que el guard server-side se haya aplicado y probado. No hacer depender la protección del copy ni del cliente. Escenario: servicio FIJO sin flag, pulsar «Solicitar contratación» → no nace trabajo hasta aceptación explícita/preautorización válida.

### P1-01 · RPC de precio con permisos abiertos a cualquier autenticado

**Evidencia:** `supabase/migrations/20261018080000_yalo_s4_bilateral_money.sql` función `external_agreed_total_for_job(uuid)` es `SECURITY DEFINER`, consulta el trabajo y precio por `job_id` sin validar `auth.uid()` ni pertenencia. Luego `grant execute ... to authenticated, service_role`. Es un canal para descubrir precio económico privado de trabajos ajenos con UUID conocido. **No aplicado todavía.**

**Fix:** revocar ejecución directa a `authenticated` para helper exclusivamente interno o añadir comprobación de roles; test outsider con UUID válido e inválido, RLS y grants. Confirmar otros helpers definer similares.

### P1-02 · Ledger omite adicionales aprobados pendientes del checkout

**Evidencia:** `external_agreed_total_for_job` suma `proposal_versions.price_amount + paid_scope_additional_for_job(job_id)`; ese helper (`20261011000003_job_paid_totals.sql`) cuenta SOLO adicionales con `status='PAID'`. Con pagos OFF, un extra aprobado mayor que cero queda `AWAITING_PAYMENT`/`PAYMENT_FAILED` (`20261011000007_job_settlement.sql`), aunque está contractualmente aceptado. Por lo tanto `agreed_total_minor`, límite de declaraciones externas y `outstanding_minor` omiten extras válidos. La sección UI de `jobs/[jobId]/page.tsx` también conserva rótulos de «requiere pago adicional confirmado».

**Fix:** distinguir `ACCEPTED_NOT_SETTLED` de `PAID`, definir total contractual = base + cambios aprobados (sin doble sumar PAID), y confirmar/registrar pago externo por scope change o ledger único. Test base 100.000 + extra aprobado 30.000 → permite confirmar 130.000 externos, no 100.000; cubrir parciales, disputas y llegada futura de checkout sin dobles cargos.

### P1-03 · Entrega remota de solo texto y autocierre

**Evidencia:** `apps/web/src/app/(account)/jobs/[jobId]/delivery-submit-form.tsx` solo solicita un `textarea` de 3–2000 caracteres. SQL `submit_job_delivery` marca `delivery_submitted_at` y `COMPLETION_REQUESTED` para `REMOTE`; `auto_complete_stale_jobs` cierra a los 7 días si existe `delivery_submitted_at`. No se verifica existencia de archivo/enlace autorizado ni evidencia concreta. Un texto cualquiera de 3 caracteres alcanza para habilitar autocierre si el cliente no responde.

**Fix:** usar adjuntos privados persistentes con referencia a entrega o enlaces verificables según tipo de trabajo, validación y retención; si falta evidencia real, no habilitar autocierre. Revisiones versionadas y accesibles al cliente. Nunca tratar comentario libre como prueba universal.

### P1-04 · Modalidad BOTH no se fija al contratar

**Evidencia:** en S3 `submit_job_delivery()` obtiene `pv.modality`; solo `REMOTE` evita PIN, mientras `BOTH` cae en recorrido presencial. `getJobNextAction` define `needsHandover = modality !== 'REMOTE'`. El SPEC exige elegir modalidad efectiva `IN_PERSON` o `REMOTE` al contratar. Un servicio que admite ambas modalidades y se ejecuta remotamente queda obligado al PIN.

**Fix:** persistir modalidad acordada por job/propuesta aceptada (no deducir de capacidades del servicio), validar remoto sin PIN, presencial con constancia o excepción documentada. Tests para IN_PERSON/REMOTE/BOTH resuelta en ambos canales.

### P1-05 · Lock ordering contradictorio en pago externo

**Evidencia:** `declare_external_payment` adquiere advisory lock del job → lock de fila jobs → opcional `FOR UPDATE` de declaración a sustituir. `respond_external_payment` toma `FOR UPDATE` de declaración ANTES del advisory lock del job. Bajo `supersede` y respuesta concurrente pueden formarse ciclos de espera y PostgreSQL abortaría una de las operaciones por deadlock.

**Fix:** lock ordering único y documentado, `advisory(job) → row(job) → row(declaration)`, evitando TOCTOU y devolviendo conflicto/retry claro. Test con dos sesiones.

### P1-06 · Migración S1 sin agenda no reserva capacidad

**Evidencia:** S1 considera `preauth_ok=true` por servicio y provider activo si ambos `proposed_schedule_start_at` y `proposed_schedule_end_at` son null; el bloqueo `provider_slot_holds` se escribe SOLO cuando hay par de fechas. Por lo tanto habilita instant booking sin ningún slot bloqueado/validado, contrario al requisito de capacidad concreta preautorizada si el trabajo precisa agenda. **Fix:** definir reglas para «sin fecha» vs trabajo reservable, o dejarlo como solicitud pendiente hasta seleccionar capacidad; tests multi-clientes sin fechas.

### P1-07 · Preparación de migraciones no validada

**Evidencia:** S1 crea exclusion constraint `provider_slot_holds_no_overlap_excl` directamente ANTES del prechequeo de overlaps; el prechequeo final usa un bound `tstzrange(...,'[')` distinto del bound válido `'[)'` del resto. En DB observada no hay holds activos (no prueba la ruta con datos). **Fix:** script `SELECT` read-only previo a DDL, sobre fixture con holds solapados y error por rango, sin `DROP` manual; migración diseñada para poder ejecutarse de forma segura sin pérdida de reservas existentes.

### P2-01 · Camino B no implementa un comparador real de propuestas

**Evidencia:** `apps/web/src/app/(account)/needs/[postId]/page.tsx` muestra el número de «ofertas» y explica que se negocian por mensajes, pero no lista tarjetas individuales de varios prestadores, no permite comparar el importe/plazo/reputación ni seleccionar visualmente al ganador. `countPostOffers()` cuenta eventos `OFFER_RECEIVED` creados al **abrir el chat**, no propuestas enviadas; el proveedor pulsa «Ofertar» para abrir un hilo, pero aún puede no haber remitido ninguna cotización. Resultado: pueden mostrarse «3 ofertas» con 0 propuestas económicas.

**Fix:** read model de últimas versiones `PROVIDER_QUOTE` por post, lista segura para dueño y privada para prestadores, cards comparables, orden claro y CTA de adjudicar sobre versión vigente. Separar «interesados» de «ofertas recibidas».

### P2-02 · Publicar necesidad está reducido a formulario único

**Evidencia:** `apps/web/src/app/(account)/needs/new/page.tsx` presenta un formulario largo de una pantalla, no el wizard 3 pasos con autosave/review del SPEC; no tiene modalidad `IN_PERSON/REMOTE`, adjuntos, borrador, ni una pantalla explícita de revisión. `createNeedAction` genera un `randomUUID()` en servidor para cada solicitud, por lo que el retrigger crea otra clave nueva y la idempotencia de DB no protege el doble POST/reintento.

**Fix:** wizard con borrador no sensible/autoguardado, modalidad, revisión y fotos seguras, nonce estable por intención que no se regenere al hacer retry. Pruebas teclado Android, atrás/refresh, error y doble submit.

### P2-03 · Escalado del feed de oportunidades y «mis necesidades»

**Evidencia:** `listOpenJobPosts` limita a 30, `listMyJobPosts` a 50, sin paginación. Cuando haya actividad el prestador no encontrará necesidades antiguas relevantes. Falta filtro zona/urgencia/fecha, orden por compatibilidad explicable, safe areas y métricas reales. No es prioritario frente a integridad.

### P2-04 · La identidad gráfica aún no está cerrada

Los archivos de marca YALO heredados del PR #22 siguen describiendo el lettering como **interino**, y S5 reconoce capturas PWA `12/10` anteriores al rebrand. No hay evidencia de screenshot Android e inspección dark/light/zoom. Tratar la terminación visual como **NO VERIFICADA**, no como PASS premium.

## 3. Cumplimiento del SPEC — matriz ejecutiva

| Dimensión | Código existe | Activado/validado en producción | Veredicto |
|---|---|---|---|
| A: descubrimiento/catalogo/chat | Sí, heredado | Sí, en parte | Funciona en base previa, exigir E2E |
| A: instant booking seguro | S1 en GitHub | **No** | **Falla D2 en producción** |
| B: publicar necesidad | S2 + páginas | **No** | Falta migración y wizard |
| B: recibir múltiples ofertas | Hilos y propuestas | **No** | Falta comparación y adjudicación única |
| Trabajo activo/agenda | Preexistente | Sí en parte | Compatibilidad pendiente |
| Entrega presencial con PIN independiente | S3 + UI | **No** | Falta migración; fix mod. BOTH |
| Entrega remota con evidencia | S3 + textarea | **No** | Prueba de entrega insuficiente |
| Pago externo bilateral | S4 + panel | **No** | Falta migración y privacidad/integridad |
| Pagos online desactivados | Sí | Flag DB `payments_online=false` | **Decisión preservada** |
| E2E 2 usuarios + Android | Reporte S5 | **No** | Sin evidencia de ejecución |
| Branding YALO | Sí | Desplegado | Wordmark/capturas provisionales |

### ¿Qué significa el reporte S5?

`docs/specs/YALO_S5_EVIDENCIA_E01-E28.md` contiene exactamente **4 `PASS-unit`**, **19 `CONTRATO`** (planes pgTAP redactados, NO ejecutados) y **5 `EXCEPCIÓN`** (pendiente E2E/dispositivo). No equivale a «E01–E28 aprobado». El caso E08 es especialmente problemático porque el test no demuestra la concurrencia que afirma el reporte. **No usamos GitHub Actions como requisito de producto**, pero los test integrados deben ejecutarse en un DB de pruebas autorizado y documentar PASS/FAIL real.

## 4. Plan de rescate / instrucciones para Muse

**SUSPENDER** aplicación de las cuatro migraciones de S1–S4 sobre producción y cualquier anuncio de funcionalidad completa. No habilitar Mercado Pago. Mantener el sitio funcionando para flujos previos: considerar deshabilitar temporalmente entradas a `/needs`, `/oportunidades` y UI S3/S4 mediante un flag coherente de frontend y backend, o desplegar una versión compatible que preserve la finalización anterior, según decisiones de releases. Los flags de producto deben ser server-authoritative; ocultar botones no bloquea RPCs.

**Lote R0 — compatibilidad actual** (primero): en staging clonado identificar escenarios actualmente afectados; evitar que «Solicitar contratación» genere un contrato inmediato antes de consentimiento; recuperar posibilidad de terminar trabajos con esquema legacy, y hacer que faltas de RPC nuevos muestren «Temporalmente no disponible» en vez de 500. Comprobar regresiones con 2 cuentas y trabajos ya existentes.

**Lote R1 — SQL previo a rollout:** arreglar índice S2, guard transaccional/unique de adjudicación, permisos definer S4, agregado de extras, modalidad job, evidencia/autocierre y locking S4. Revisar `provider_slot_holds` y `create or replace view` contra DB clon. No editar histórico de migraciones ya aplicadas en producción; estas cuatro NO están aplicadas, pero definir si corregirlas antes de despliegue o agregar nuevas migraciones compensatorias con trazabilidad.

**Lote R2 — pruebas DB reales:** ejecutar S1–S4 en un **clon/sandbox** en el orden correcto con historial remoto real, pgTAP de fixtures y pruebas adversariales concurrentes (2 prestadores adjudicando, pago externo parcial con extra, outsider precio, entrega remota vacía, PIN y autocierre, ambos clientes mismo slot). Guardar output SQL, script de rollback, firma/grants y plan de despliegue manual.

**Lote R3 — UX v1 efectiva:** comparador de ofertas y recuento correcto; wizard 3 pasos con borradores y modality; entrega digital con evidencias; resolución de BOTH; mejorar navegación real, states, errores y CTA por rol. Screenshots 360/390/412, dark/light, PWA, Chrome Android.

**Lote R4 — migración a producción explícitamente autorizada:** despliegue coordinado DB **antes de** activar UI nueva; smoke E01–E28 con dos cuentas y logs sin error, incluyendo usuarios ya existentes; rollback compatible. Desplegar sin activar Mercado Pago ni exigir GH Actions.

### Gates mínimos (no negociables)

1. `create index conversations(job_post_id)` solo DESPUÉS de tener columna y se ejecuta en staging.
2. Una solicitud de una plaza no puede dar 2 jobs por ninguna secuencia/carrera.
3. No hay `SECURITY DEFINER` abierto que revele importes de terceros.
4. Extras aceptados se incorporan al total acordado externo y al saldo; no doble cobranza.
5. Trabajo con entrega remota usa evidencia verificable y no PIN; BOTH obliga a elegir modalidad efectiva.
6. 2 usuarios comprueban contrato → agenda → ejecución → entrega → cierre → declaración/confirmación externa → reseña, con exceptions.
7. Producción no muestra CTA roto a RPC/table inexistente y sigue siendo compatible con datos anteriores.
8. Todo PASS integra logs/comprobantes de ejecución y no confunde test escrito con ejecutado.

## 5. Archivos de referencia para implementación

- Spec v1.0 aprobado en rama documental: `docs/yalo-spec-v1-dual-marketplace-20261014/docs/specs/YALO_MARKETPLACE_END_TO_END_SPEC_V1_2026-10-14.md`.
- Estado de la entrega de Muse: `docs/specs/YALO_S5_EVIDENCIA_E01-E28.md`.
- SQL S1–S4: `supabase/migrations/20261016080000_*`, `20261016090000_*`, `20261017080000_*`, `20261018080000_*`.
- Cliente: `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx`, `apps/web/src/app/(account)/needs`, `apps/web/src/app/(account)/jobs`.
- Prestador: `apps/web/src/app/(account)/oportunidades`, `apps/web/src/app/(provider)/provider/manage`.
- API: `apps/web/src/lib/jobs/{server,job-posts-server,external-money}.ts`, `apps/web/src/lib/ui/direct-booking.ts`.
- SQL legacy: `supabase/migrations/20261010000000_hire_on_accept.sql`, `20261011000003_job_paid_totals.sql`, `20261011000007_job_settlement.sql`.

## 6. Integridad de evidencia y límites

- Las lecturas a Supabase fueron SELECT/inspección de metadatos sin escrituras de usuarios, migraciones ni cambios de flags.
- `READY` de Vercel confirma construcción/puesta en servicio, no compatibilidad funcional. Logs agrupados 24h mostraron solo warnings `url.parse` del dispatcher en deploys anteriores; no se deduce ausencia de errores no visitados.
- No se ejecutaron pruebas pgTAP ni tareas en GitHub Actions; no se creó cuenta para simular clientes ni se probó app desde móvil real. Las fallas de migraciones e integridad arriba están basadas en código verificable, no en E2E observado.
- El reporte es una auditoría sin cambios en GitHub, Supabase o Vercel. Modificar DB exige permiso explícito y backup/rollback.
