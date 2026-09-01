# Phase 04 — Conversations and realtime

## Estado final

**Rama:** `codex/phase-04-conversations`  
**FINAL HEAD SHA:** `389d7c18740509f12dbbf11f34828bd8ee90f05e`  
**CI RUN ID:** `33534888959`  
**validate:** `success`  
**supabase-integration:** `success`  
**Playwright total y resultado:** 32 tests passed (Chromium desktop + Pixel 5 mobile-web)  
**pgTAP total:** 15 test files, 252 tests passed  
**Lighthouse scores:** Home performance: 98 | Search performance: 99

Phase 04 queda finalizada, auditada y cerrada de acuerdo con `CHANGAS_MASTER_PLAN.md` y `docs/superpowers/plans/2026-08-31-phase-04-conversations.md`. No se inició Phase 05 y no se introdujeron tablas, endpoints, propuestas, jobs, pagos, reputación ni administración.

---

## Alcance implementado

1. **Modelo de conversación contextual:** inicio de conversación desde el CTA de un servicio público (`/p/[slug]/[serviceSlug]`), vinculando cliente, proveedor y servicio inmutablemente.
2. **Autorización y RLS participant-only:** sólo los participantes de la conversación pueden leer o interactuar con el hilo, mensajes, adjuntos y eventos de moderación.
3. **Inbox (`/messages`):** bandeja de entrada mobile-first para usuarios autenticados con contador de no leídos, avatar público, nombre de la contraparte, título del servicio, vista previa y marca temporal.
4. **Hilo de conversación (`/messages/[conversationId]`):** cabecera con contexto del servicio, enlace al servicio, menú contextual (bloqueo/reporte), historial paginado y área de composición fija.
5. **Mensajes de texto e idempotencia:** límite de 4000 caracteres, nonce UUID idempotente de cliente y rate limit a nivel de base de datos (20 mensajes/minuto por emisor en la conversación).
6. **Paginación keyset:** consulta de mensajes ordenados por `(created_at, id)` con cursor y páginas de hasta 50 mensajes.
7. **Adjuntos privados e imágenes/archivos:** bucket privado de Supabase Storage (`conversation-attachments`), subida en dos pasos con registro de metadatos vía RPC y descarga autorizada mediante URLs firmadas de corta duración (5 minutos) a través de `/messages/attachments/[attachmentId]`.
8. **Realtime y convergencia:** suscripción a cambios de Postgres (`messages` INSERT) filtrada por `conversation_id`, con deduplicación pura de mensajes por `message_id` y refresco seguro sin bucles de hidratación.
9. **Estado de lectura / unread:** cursor de lectura único por usuario y conversación (`conversation_reads`), actualizando posición y tiempo de lectura.
10. **Eventos de sistema:** base inmutable para eventos del sistema (`kind = 'SYSTEM'`, `sender_user_id = null`), no editable por usuarios autenticados.
11. **Detección de leakage y advertencia:** detector determinístico de patrones obvios (teléfonos, emails, handles de pago, pedidos de contacto externo) en `@changas/domain`. Advertencia interactiva antes de enviar con opción explícita de «Enviar de todos modos». Registro de evento de moderación sin almacenar texto sensible.
12. **Bloqueo y reporte:** bloqueo bidireccional que inhabilita nuevos mensajes preservando el historial contractual previo, y reportes categorizados con RLS participant-only.
13. **Seguridad en runtime:** script de verificación de runtime (`apps/web/scripts/phase-04-conversations-runtime.mjs`) que prueba accesos de cliente, proveedor y outsider sobre RLS, Storage y RPCs.

---

## Arquitectura y base de datos

### Schema y tablas (`supabase/migrations/`)

- `public.conversations`: tabla principal con `service_id`, `client_user_id`, `provider_user_id`, `status` (`OPEN`, `BLOCKED`, `CLOSED`), marcas temporales y constraint de unicidad `(service_id, client_user_id, provider_user_id)`.
- `public.conversation_participants`: roles `CLIENT` y `PROVIDER` con RLS estricto.
- `public.messages`: mensajes del hilo con `kind` (`TEXT`, `IMAGE`, `FILE`, `SYSTEM`), `body`, `sender_user_id`, `client_nonce` con constraint único `(conversation_id, client_nonce)`.
- `public.message_attachments`: metadatos de adjuntos (`storage_path`, `mime_type`, `size_bytes`, `original_name`) sin URLs públicas.
- `public.conversation_reads`: cursor de última lectura por usuario (`last_read_message_id`, `last_read_at`).
- `public.user_blocks`: registros de bloqueo entre usuarios dentro del contexto de conversación.
- `public.conversation_reports`: reportes de usuarios con categoría y motivo.
- `public.conversation_moderation_events`: eventos de moderación de auditoría (e.g., advertencias de leakage) sin texto crudo.

### RPCs de seguridad autoritativa (`SECURITY DEFINER`)

- `start_service_conversation(target_provider_slug, target_service_slug)`
- `list_my_conversations(limit_count, before_updated_at, before_id)`
- `get_conversation_context(target_conversation_id)`
- `send_conversation_text(target_conversation_id, message_body, message_nonce)`
- `list_conversation_messages(target_conversation_id, before_created_at, before_id, page_size)`
- `create_conversation_attachment_message(target_conversation_id, attachment_kind, message_nonce)`
- `register_conversation_attachment(target_message_id, object_path, attachment_mime_type, attachment_size_bytes, attachment_original_name)`
- `get_conversation_attachment(target_attachment_id)`
- `mark_conversation_read(target_conversation_id, through_message_id)`
- `block_user_for_conversation(target_conversation_id, target_user_id)`
- `unblock_user(target_conversation_id, target_user_id)`
- `get_my_conversation_block_state(target_conversation_id)`
- `report_conversation(target_conversation_id, report_category, report_reason)`
- `record_conversation_moderation_warning(target_conversation_id, signal_types)`

---

## Resolución de incidencias técnicas

Durante la fase se diagnosticó un fallo en el test E2E del hilo de conversación (`"The destination stream closed early"` en Next.js App Router).

**Causa raíz identificada:**
La función de configuración de cliente `getPublicSupabaseEnv()` en `packages/config/src/public.ts` utilizaba acceso indexado `process.env[name]`. En compilación de navegador / Next.js bundler, las variables `NEXT_PUBLIC_*` sólo son sustituidas estáticamente cuando se accede mediante expresión de miembro literal (`process.env.NEXT_PUBLIC_*`). Al evaluar `process.env[name]` en el cliente resultaba `undefined`, lanzando un error en la inicialización del cliente de Supabase durante la hidratación del `ConversationThread`, lo que abortaba el stream RSC.

**Solución aplicada:**

1. En `packages/config/src/public.ts`, se normalizó el acceso a `process.env.NEXT_PUBLIC_SUPABASE_URL` y `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de forma directa y tipada.
2. Se restauró el componente `ConversationThread` completo con todos sus submódulos (historial, TextComposer con advertencia de leakage, AttachmentComposer, ReportForm, bloqueo/desbloqueo y Realtime).
3. Se limpiaron todos los logs e instrumentaciones de diagnóstico temporales.

---

## Verificación y auditoría de seguridad

1. **Aislamiento de participantes:** usuarios no autenticados o usuarios autenticados ajenos a la conversación no pueden leer contexto, mensajes ni descargar adjuntos (verificado por pgTAP y runtime security script).
2. **Protección de Storage:** el bucket `conversation-attachments` es privado; no existen URLs públicas de objetos; las descargas pasan por validación previa de participante y URLs firmadas de 5 minutos.
3. **Privacidad de datos personales:** el hilo y el inbox sólo muestran nombres y avatares públicos; no se exponen teléfonos, correos ni datos privados.
4. **Idempotencia:** reintentos con el mismo `client_nonce` no generan duplicados en la base de datos ni en la UI.
5. **Preservación de historial:** el bloqueo inhabilita nuevos mensajes pero no elimina el historial preexistente.
6. **No filtración de Phase 05:** ninguna tabla, RPC o vista de propuestas, ofertas, órdenes o pagos fue creada en esta fase.

---

## Dictamen final

**PHASE 04 — PASS / APPROVED**
