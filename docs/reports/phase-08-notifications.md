# Phase 08 — Notifications & PWA

## Estado final

**Fase:** Phase 08 — Notifications & PWA  
**Rama de recuperación:** `codex/phase-08-recovery`  
**Base aprobada (Phase 07):** `114c3c8b610f3f7fc93c540ef89206ff1d996805`  
**Functional HEAD SHA:** `d375ea04e71d9a65f1734089635ff4793caf4304`  
**Functional CI RUN ID:** `33716795142`  
**validate:** `success`  
**supabase-integration:** `success`  
**Vitest:** 35 archivos, 106 tests passed  
**pgTAP:** 27 archivos, 398 tests passed  
**Playwright:** 44 tests passed (22 Chromium desktop + 22 Pixel 5/mobile-web)  
**Lighthouse mobile:** Home `/` = 98 | Search `/buscar` = 90

La implementación funcional de Phase 08 queda en **PASS** contra el alcance y los criterios de aceptación de `CHANGAS_MASTER_PLAN.md` y `docs/superpowers/plans/2026-09-02-phase-08-notifications-pwa.md`.

Esta fase se completó en una rama de recuperación porque una Phase 09 parcial había sido creada prematuramente desde un HEAD incompleto de Phase 08. La recuperación volvió a la base aprobada de Phase 07, preservó el trabajo válido ya existente de Phase 08 y completó los bloques faltantes sin incorporar funcionalidad de Phase 09.

La aprobación formal exige además que el commit que contiene este reporte complete su propio pipeline CI completamente GREEN. El SHA y el CI exactos de ese cierre se registran en la respuesta final de aprobación para evitar una auto-referencia imposible dentro del propio commit.

---

## 1. Alcance implementado

1. **Autoridad de notificaciones en PostgreSQL**
   - `notifications` es la fuente autoritativa de actividad visible dentro de Changas.
   - `notification_preferences` conserva las preferencias por usuario.
   - `push_subscriptions` conserva únicamente suscripciones del usuario propietario.
   - `notification_delivery_outbox` mantiene la cola server-side de entregas externas y no queda expuesta al navegador.

2. **Centro de notificaciones in-app**
   - `/account/notifications` lista actividad real del usuario.
   - Soporta unread/read individual y “marcar todas como leídas”.
   - El layout autenticado muestra badge de no leídas.
   - Los enlaces de acción se mantienen dentro de destinos permitidos del producto.

3. **Preferencias explícitas**
   - Push para eventos accionables.
   - Email para eventos importantes.
   - Recordatorios de Jobs.
   - Alertas de propuestas.
   - Alertas de verificación.
   - Promocionales separados de señales críticas del producto.
   - El canal in-app permanece disponible aunque se desactiven canales externos.

4. **Routing anti-spam y privacidad por tipo de evento**
   - `MESSAGE`: in-app only; no email ni push por mensaje trivial.
   - Propuestas, Jobs y verificación: canales externos sólo cuando la política y preferencias lo permiten.
   - Reviews: push permitido, email deliberadamente no habilitado.
   - Las notificaciones externas usan copy seguro y no incluyen contenido privado de mensajes, pagos, direcciones ni documentos.

5. **Push opt-in sólo por gesto del usuario**
   - `Notification.requestPermission()` se ejecuta únicamente desde el botón explícito de activación.
   - Estado `denied` o plataforma no compatible degrada de forma segura al centro in-app.
   - La ausencia de suscripción push no rompe la mutación de dominio que generó la notificación.

6. **Web Push con VAPID server-side**
   - Adapter `WebPushProvider` separado del routing de dominio.
   - Credenciales privadas VAPID permanecen server-only.
   - 404/410 elimina endpoints push obsoletos.
   - Fallas de red/proveedor se clasifican y vuelven al ciclo de retry controlado.

7. **Email transaccional mediante Resend**
   - Adapter `ResendEmailProvider` separado del dominio.
   - `RESEND_API_KEY` y remitente sólo se consumen del lado servidor.
   - Mensajes triviales de chat no generan email.
   - Proveedor no configurado o error de red produce resultado retryable en vez de romper el flujo de negocio.

8. **Dispatcher protegido**
   - Endpoint final: `/api/internal/notifications/dispatch`.
   - Requiere `Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>`.
   - Usa runtime Node y `Cache-Control: no-store`.
   - Materializa recordatorios, reclama leases de delivery, envía mediante adapters y registra resultado.
   - El path `internal` es una desviación nominal deliberada respecto al ejemplo del plan (`/api/notifications/dispatch`) para hacer explícita su naturaleza operativa; no cambia el contrato de seguridad.

9. **Recordatorios de Job**
   - Se materializan para Jobs próximos dentro de la ventana definida por Phase 08.
   - La creación es idempotente.
   - Estados no aplicables/terminales quedan excluidos.
   - La preferencia de recordatorios se respeta al decidir canales externos.

10. **PWA instalable**
    - Manifest `standalone` con iconos 192x192 y 512x512.
    - Prompt de instalación propio cuando la plataforma expone el evento correspondiente.
    - La app sigue siendo usable cuando el navegador no ofrece instalación programática.

11. **Service worker seguro**
    - Cache estático limitado a shell offline, iconos y `/_next/static/`.
    - Navegaciones usan network-first.
    - No se persisten páginas privadas autenticadas ni respuestas de APIs como fuente offline.
    - Si la red no está disponible, una navegación cae a `/offline` en vez de mostrar Jobs, pagos, mensajes o datos privados potencialmente obsoletos.

12. **Actualización de PWA explícita**
    - Un worker nuevo en espera muestra UX de actualización.
    - Sólo después de que el usuario toca “Actualizar” se envía `SKIP_WAITING` y el cambio de controller puede recargar la página.
    - La primera instalación/claim del service worker no fuerza una recarga automática.

13. **E2E final desktop + mobile**
    - Notificación real desde transición de verificación `IDENTITY_PENDING → ACTIVE`.
    - Unread badge, lectura y persistencia de preferencias.
    - Push `denied` sin prompt automático y navegación autenticada intacta.
    - Manifest, registro de SW y offline shell seguros.
    - Los tres journeys se ejecutan tanto en Chromium desktop como en Pixel 5/mobile-web.

---

## 2. Migraciones principales

- `supabase/migrations/20260902160000_phase_08_notifications.sql`
  - autoridad base de notificaciones, preferencias, suscripciones y outbox;
  - RLS, grants y RPCs owner-safe.
- `supabase/migrations/20260902161000_phase_08_notification_routing.sql`
  - política de routing por evento;
  - triggers/eventos de propuestas, Jobs, reviews y verificación;
  - separación de notificación in-app y entregas externas.
- `supabase/migrations/20260902162000_phase_08_job_reminders.sql`
  - materialización idempotente de recordatorios próximos;
  - exclusión de estados no aplicables.
- `supabase/migrations/20260902162500_phase_08_delivery_v2.sql`
  - claim con lease para entregas;
  - retry/finalización server-authoritative;
  - protección contra doble procesamiento y workers concurrentes.

---

## 3. Código de aplicación y UI

Principales superficies incorporadas o extendidas:

- `apps/web/src/app/(account)/account/notifications/page.tsx`
- `apps/web/src/app/(account)/account/notifications/actions.ts`
- `apps/web/src/app/(account)/layout.tsx`
- `apps/web/src/components/notifications/notification-preferences-form.tsx`
- `apps/web/src/components/pwa/push-opt-in.tsx`
- `apps/web/src/components/pwa/install-prompt.tsx`
- `apps/web/src/components/pwa/service-worker-register.tsx`
- `apps/web/src/lib/notifications/server.ts`
- `apps/web/src/lib/notifications/dispatcher.ts`
- `apps/web/src/lib/notifications/providers.ts`
- `apps/web/src/lib/notifications/templates.ts`
- `apps/web/src/app/api/internal/notifications/dispatch/route.ts`
- `apps/web/public/sw.js`
- `apps/web/src/app/offline/page.tsx`
- `tests/e2e/phase-08-notifications-pwa.spec.ts`

El centro de notificaciones es una superficie autenticada dinámica. Las operaciones de lectura/preferencias utilizan la sesión del usuario y los RPCs owner-safe; el dispatcher externo usa un cliente privilegiado exclusivamente server-side.

---

## 4. Seguridad, RLS y aislamiento de secretos

- Las tablas Phase 08 tienen RLS activa.
- Un usuario autenticado sólo puede consultar/modificar sus propios objetos expuestos.
- El outbox de delivery no ofrece DML directo a roles de navegador.
- Claims y finalización de delivery se realizan mediante RPCs server-side.
- La mutación principal nunca depende del éxito de push/email.
- `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY` y `NOTIFICATION_DISPATCH_SECRET` no usan prefijo `NEXT_PUBLIC_*`.
- El endpoint operativo exige Bearer secret y no devuelve cacheable data.
- Push usa contenido genérico seguro; no transporta el body privado de una conversación ni datos sensibles de Jobs/pagos/documentos.
- El service worker no implementa cache-first para navegación privada ni APIs autenticadas.

Variables documentadas en `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NOTIFICATION_DISPATCH_SECRET`

---

## 5. Delivery policy, retries y anti-spam

`dispatchNotificationBatch` mantiene la entrega externa desacoplada del evento de negocio:

1. materializa recordatorios debidos;
2. reclama un batch con lease limitado;
3. construye payload seguro según canal;
4. invoca Web Push o Resend;
5. elimina endpoint push si el proveedor devuelve 404/410;
6. registra éxito, retry o fallo permanente mediante RPC autoritativo.

La prueba runtime Phase 08 confirma en una base real:

- ventana de recordatorios de 24 h;
- idempotencia;
- exclusión de estados no elegibles;
- respeto de preferencias;
- `MESSAGE` in-app only;
- proposal/job/verification según canales habilitados;
- review push-only;
- ausencia de push subscription sin romper la operación de dominio;
- proveedor externo no configurado o temporalmente fallando sin crash del dispatcher.

---

## 6. PWA, offline e instalación

La estrategia final evita convertir la PWA en una fuente de datos privados obsoletos:

- `changas-static-v2` guarda sólo `/offline`, iconos y recursos estáticos inmutables.
- Navegación: network-first y fallback a `/offline` cuando fetch falla.
- El offline shell comunica explícitamente que Changas necesita internet para datos actualizados y que no se muestran Jobs, pagos, mensajes ni datos privados stale.
- Push notification click limita destinos a raíces internas permitidas (`/messages`, `/jobs`, `/account`, `/provider`) y cae al centro de notificaciones ante una URL no válida.
- La instalación es progresiva: no disponer de prompt instalable no bloquea el uso web.

### Limitación iOS/Safari explícita

El CI Linux/Chromium no puede demostrar de forma honesta la UI nativa de “Agregar a pantalla de inicio” de Safari/iOS, el transporte APNs/Web Push real de un dispositivo Apple ni sus permisos a nivel SO. El código mantiene fallback web/in-app y no depende de esos affordances para funcionar. La validación en un iPhone/Safari real queda como QA de despliegue/plataforma, no como una garantía simulada por CI.

---

## 7. Evidencia de pruebas y cierre funcional

### Vitest

- **35 archivos**.
- **106/106 tests passed**.
- Incluye contratos de notification server layer, templates, delivery, UI, install prompt, PWA y permisos push.

### pgTAP

- **27 archivos**.
- **398/398 tests passed**.
- Phase 08 incluye:
  - `phase-08-notifications.sql`;
  - `phase-08-notification-routing.sql`;
  - `phase-08-reminders.sql`;
  - `phase-08-delivery-v2.sql`.

### Runtimes de integración

Todos PASS en Functional CI `33716795142`:

- Supabase client/Storage runtime security.
- Phase 03 discovery runtime.
- Phase 04 conversations runtime.
- Phase 05 proposals/payment runtime.
- Phase 06 scheduling/holds runtime.
- Phase 06 transactional scheduling integrity runtime.
- Phase 06 exact-location runtime.
- Phase 06 Jobs runtime.
- Phase 07 verified review authority runtime.
- Phase 07 reputation metrics/ranking runtime.
- Phase 07 rehire/account reputation runtime.
- **Phase 08 notification authority runtime.**
- **Phase 08 delivery policy/reminder runtime.**

### Browser E2E

- **44/44 passed** en 28.2 s.
- **22 Chromium desktop + 22 Pixel 5/mobile-web**.
- Los 6 casos Phase 08 (3 journeys × 2 proyectos) verifican:
  - evento de verificación real → unread → read;
  - persistencia de preferencias;
  - `Notification.permission = denied` sin llamada automática a `requestPermission()`;
  - navegación autenticada a Jobs/Messages intacta;
  - manifest standalone + iconos 192/512;
  - registro real de `/sw.js`;
  - offline shell seguro;
  - ausencia de overflow horizontal en superficies Phase 08 probadas.
- Se conservan también todos los E2E heredados Phase 02–07.

### Lighthouse mobile

- Home `/`: **98**.
- Search `/buscar`: **90**.
- Ambos superan el umbral CI requerido.

---

## 8. RED → GREEN y debugging relevante

### Delivery policy runtime

El workflow abrió primero el step `Run Phase 08 delivery policy runtime checks` sin que el runtime existiera. Ese RED se observó después de que todos los gates anteriores pasaran. Se implementó luego el runtime contra RPCs y tablas reales, y el step quedó GREEN antes de continuar el cierre.

### Regresión latente de service worker durante login

Al completar instalación/update UX apareció un fallo determinístico de Playwright en el journey heredado `/provider/manage`.

La investigación aislada demostró dos problemas:

1. El assertion histórico `toHaveURL(/\/provider\/manage$/)` producía un falso positivo semántico porque `/login?next=/provider/manage` también termina con `/provider/manage`.
2. En un contexto limpio aparecían dos requests consecutivos al login y ninguna cookie auth. El registrador recargaba incondicionalmente ante cualquier `controllerchange`, mientras `sw.js` ejecutaba `clients.claim()` durante la primera activación. Esa primera toma de control podía recargar el documento en medio del login y abortar la persistencia de sesión.

TDD aplicado:

- RED: `5691a8f92bde35e457704896b08c4bc029f258a3` añadió un contrato que prohíbe reload automático durante el claim inicial. El CI dejó **105 tests GREEN y sólo ese test RED**.
- GREEN: `7851d9585b50a04fd314aa5ae781f45207987c21` introdujo una bandera que habilita reload únicamente cuando el usuario pulsa “Actualizar” antes de enviar `SKIP_WAITING`.
- Verificación: CI `33716143780` terminó completamente GREEN, incluido el Playwright heredado de `/provider/manage`.

No se ocultó ni relajó el test de autenticación; se corrigió la causa raíz del race.

### E2E Phase 08 final

El primer commit del spec final pasó lint, typecheck, unit tests y build, pero Prettier lo rechazó antes de ejecutar Supabase. Se usó una rama descartable de formato para obtener el output exacto de Prettier y se aplicó únicamente ese resultado, sin cambiar comportamiento. El Functional HEAD posterior `d375ea04e71d9a65f1734089635ff4793caf4304` cerró todos los gates GREEN.

---

## 9. Acceptance checklist

- [x] Notification center real y owner-scoped.
- [x] Unread/read persistente y badge autenticado.
- [x] Preferencias de canales persistentes.
- [x] Push permission sólo se solicita por gesto explícito.
- [x] `denied`/unsupported no bloquea el producto.
- [x] Mensajes triviales no generan email/push spam.
- [x] Push no contiene contenido privado de conversación/pago/documentos.
- [x] Push subscription ausente no rompe mutaciones de dominio.
- [x] Web Push y email están detrás de adapters server-side.
- [x] Delivery utiliza leases/retry/fallo controlado.
- [x] Recordatorios próximos son idempotentes y respetan estados/preferencias.
- [x] Service worker no cachea páginas privadas/APIs autenticadas como fuente offline.
- [x] Offline no muestra Jobs/pagos/mensajes privados stale.
- [x] Manifest instalable con 192/512.
- [x] Update UX no recarga durante el primer claim del SW.
- [x] Desktop y mobile E2E completamente GREEN.
- [x] Lighthouse mobile dentro del gate.

---

## 10. Dependencias de despliegue y limitaciones explícitas

- **Credenciales reales de proveedores:** CI no envía push a un push service real ni emails reales por Resend porque no debe depender de secretos de producción ni producir side effects externos. Sí verifica routing, templates, clasificación de respuestas, provider-unconfigured, retry y persistencia de delivery.
- **Scheduler/cron de producción:** el endpoint protegido está listo para invocación programada, pero la frecuencia concreta del scheduler pertenece a la configuración del entorno de despliegue. El código no finge que exista un cron si aún no se configuró en la plataforma.
- **Safari/iOS:** instalación y Web Push nativos requieren QA en hardware/Safari real; Chromium CI verifica el contrato web y los fallbacks seguros.
- **Rate limit de imágenes Docker:** GitHub Actions recibió respuestas transitorias `toomanyrequests` al descargar imágenes de Supabase, pero el CLI reintentó y el run funcional terminó exitosamente. No corresponde a una falla del producto.

---

## 11. Recuperación de secuencia de fases

Phase 09 ya contenía trabajo parcial creado desde el antiguo HEAD incompleto `5d7d3072cbcc7d1420e515f8a1f5bb48c2881670`. Ese historial se mantuvo intacto durante la recuperación de Phase 08.

Después de que **el commit de este reporte** tenga CI completamente GREEN, la recuperación autorizada puede:

1. tomar el Final HEAD formal de Phase 08 como nueva base;
2. reproducir el trabajo existente de Phase 09 sin perder Admin Core/RBAC;
3. demostrar nuevamente el checkpoint GREEN de Admin Core/RBAC;
4. restaurar el intentional RED de identity review;
5. continuar Phase 09 desde ese RED mediante TDD.

No iniciar Phase 10 hasta que Phase 09 tenga su propio cierre formal.

---

## Dictamen

**PHASE 08 — PASS / APPROVED**, condicionado únicamente a que el commit que contiene este reporte complete su propio CI final en verde, requisito que debe verificarse antes de emitir la aprobación formal y antes de reconciliar Phase 09.

**STOP:** no modificar la rama original de Phase 09 hasta confirmar el CI del report commit de Phase 08.
