# YALO — correcciones implementadas tras auditoría del SPEC v1.0

**Rama:** `fix/yalo-spec-v1-audit-integrity-20261015`  
**Base:** `30955973ca47ddef0a09b5aeb7ae14d79c3c5d05` (PR #28).  
**Estado:** código en revisión, **NO desplegado**. La migraciones S1–S4 siguen ausentes en producción al momento de la auditoría. **No habilitar cobros online ni ejecutar `supabase db push`.**

## Corregido en la rama

1. **S2 migrable:** `conversations.job_post_id` se añade antes del índice; la solicitud pública registra en `job_post_awards` un único trabajo ganador, con guard `BEFORE INSERT` y bloqueo de fila antes de insertar `jobs`. El segundo intento sobre `HIRED` falla y revierte su propuesta.
2. **S2 privacidad / UX:** RPC `list_job_post_offer_cards` solo para dueño, filtra propuestas con precio real del prestador, ofrece comparador de tarjetas y cuenta propuestas, no simples chats; paginación de oportunidades/mis necesidades.
3. **S1:** reserva directa sin autorización efectiva deja de salir en la UI/acciones de propuesta. Preflight de holds anterior a constraint anti-solape; si no hay franja reservable se genera oferta pendiente, no contrato. Test actualizado para slot realmente disponible y bloqueado.
4. **S3 compatibilidad:** si `get_job_detail` viene de DB legacy sin columnas de entrega, el prestador puede usar el antiguo cierre por PIN y el cliente ve el código. Con S3 el prestador envía entrega y luego verifica constancia presencial; remoto exige un enlace HTTPS y no se autocierra solo porque existe texto/URL. Se guarda modalidad efectiva `IN_PERSON/REMOTE` en trabajos cuyo servicio era `BOTH`, decidida por el cliente antes de entrega.
5. **S4:** helper de precio económico revoca `EXECUTE` a `authenticated`; RPC con ownership conserva acceso; total contractual agrega extras `PAID` + `AWAITING_PAYMENT` + `PAYMENT_FAILED`. Respuesta/anulación unifican orden de locks advisory→fila→job.
6. **Rollout:** rutas `/needs` y `/oportunidades` no consultan tablas inexistentes cuando el flag `YALO_PUBLIC_NEEDS_ENABLED` está OFF (por defecto); acciones server-side también lo comprueban. Oculta CTA en `/jobs` hasta autorización. La protección de DB/RPC es independiente del flag.
7. **Crear necesidad:** wizard de tres pasos, revisión final, borrador temporal de sesión y misma clave de idempotencia en reintentos del formulario (no se genera una nueva UUID por POST).
8. **Pruebas:** pgTAP S2 tiene ahora dos proveedores y segundo intento de adjudicación; S4 comprueba permisos y extra contractual pendiente; S3 exige enlace digital; S1 no autoacepta sin ventana. Son **tests escritos y revisados estáticamente; NO reportar PASS hasta ejecutarlos en una DB de staging**.

## Pruebas necesarias antes del merge — bloqueo de release

- Preparar staging/clone de Supabase con historial remoto real. El proyecto no ofrece actualmente una development branch conectada y hay **58 migraciones históricas remotas sin versión local**. No crear recursos de pago sin consentimiento. No usar `supabase db push`.
- Instalar S1→S4 en staging real en una transacción o secuencia migratoria planificada, capturar SQLSTATE, grants, signatures y reversiones; ensayar rollback y preserved data.
- Ejecutar los 4 pgTAP S1–S4 y el conjunto legacy; probar E08 con sesiones concurrentes **reales** (el pgTAP añadido prueba el rechazo secuencial, no una carrera de dos conexiones simultáneas). Probar renovaciones/no-show, mismo slot, pagos parciales y legado BOTH.
- Ejecutar localmente `pnpm --filter @changas/web typecheck`, `pnpm --filter @changas/web lint`, `pnpm test`, `pnpm --filter @changas/web build`; fijar errores de código antes de merge. No declarar pruebas ejecutadas por el mero hecho de crear este informe.
- Sesiones reales cliente+prestador: contratación camino A y B, dos ofertas, agenda, ambas modalidades, entrega, disputa/corrección, PIN y cierre, declaración de dinero ajeno, confirmación y reseña; captura de Android 360/390/412 y dark/light.
- **NO MERGE/DEPLOY hasta resolver lo anterior.** La activación de `YALO_PUBLIC_NEEDS_ENABLED=true` es una decisión posterior y expresa; con base de datos no desplegada mantiene OFF.

## Pendientes que requieren una segunda intervención / insumos

- **Evidencia digital plena:** la URL HTTPS permite revisión humana, **pero no prueba criptográficamente existencia ni contenido**. Falta un sistema privado de adjuntos/deliverables versionados y retención; por eso el autocierre remoto está deshabilitado por seguridad.
- **Modality BOTH:** el cliente puede elegir modalidad efectiva tras contratar, antes de entregar; el SPEC ideal fija modalidad en la **aceptación del contrato**, por lo que sigue pendiente mover esta elección al snapshot/versionado contractual.
- **Borradores y archivos del wizard:** borrador temporal es `sessionStorage`, no una entidad duradera en DB ni subida segura de fotos. Evitar poner DNI, números de cuenta, teléfono o domicilio exacto en el texto libre; quedan pendientes fotos privadas y política de retención.
- **Rebrand:** wordmark SVG YALO proviene de reconstrucción interina y screenshots PWA siguen sin aprobación visual ni reemplazo mediante capturas reales. Pedir SVG/logo maestro y capturas de dispositivos; no inventarlos.
- **Pruebas end-to-end y deploy real** ausentes hasta tener staging con usuarios seed y acceso a browser Android. Ningún pago en línea debe activarse.

## Verificaciones concretas

- `select version from supabase_migrations.schema_migrations where version in ('20261016080000','20261016090000','20261017080000','20261018080000');` devuelve 0 filas **en producción auditada antes del cambio**.
- `select to_regclass('public.job_posts'), to_regclass('public.job_post_awards'), to_regclass('public.external_payment_declarations');` debe devolver OIDs en staging después de S2/S4.
- `select has_function_privilege('authenticated','public.external_agreed_total_for_job(uuid)','EXECUTE');` debe ser `false` después de S4.
- Intentar contratar segunda propuesta del mismo post debe causar error `40001` y dejar exactamente un job y una award. Cualquier fallo de constraint o migration detiene rollout.
- No asumir que una respuesta `READY` de Vercel equivale a éxito de RPC / QA.
