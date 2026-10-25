# MUSE CODE · YALO rebranding + auditoría cliente/prestador · plan de implementación

**Encargo autorizado por el propietario:** cambiar marca pública y lenguaje visual **Changas → YALO**, alineados con **la propuesta de la izquierda** de la captura suministrada: símbolo de persona en Y (cian → turquesa → menta), fondo navy, YALO geométrico, lema «TRABAJÁ · CONTRATÁ · CRECÉ». **No** usar ni mezclar `tuki` y `Extra`. Implantar correcciones de experiencia y seguridad auditadas sin activar cobros reales ni usar GitHub Actions.

**Fuente visual:** captura facilitada por el usuario el 14/10/2026. **No es un SVG maestro**: no afirmar reproducción idéntica hasta reconstrucción/validación. Guía: [YALO Brand System](../brand/yalo/YALO_BRAND_SYSTEM.md). Boceto técnico **no definitivo**: [SVG de isotipo](../brand/yalo/yalo-isotipo-boceto.svg).

**Repo:** `gabsvm/changas`. **Snapshot auditado:** `main` `4cffce41d535ba307578b6f90a1f97e1a43538a0` (14/10/2026). **Deploy auditado:** Vercel `dpl_E1zQGQuKvBk56d3eU6w1fEyc6uDx` READY, alias `changas-web-gray.vercel.app`. Cambios posteriores a ese SHA deben reanalizarse, no machacarse. Trabajar en rama/PR, actualizar desde main antes de modificar código.

**Alcance explícito:** experiencia completa de la cuenta cliente y de la cuenta prestadora, desde descubrimiento/alta hasta cierre, incidencia y reseña; UI/UX premium web/PWA/mobile; identidad corporativa completa.

**Fuera de alcance y restricciones:** no GitHub Actions como gate; no habilitar `PAYMENTS_ENABLED`, Mercado Pago, OAuth, webhooks o cargos reales; no reemplazar Vercel/Supabase/DB ni introducir un nuevo dominio; no usar `supabase db push` sobre prod. Los administradores pueden usar simulaciones de pago existentes para ensayos autorizados, pero jamás se confunden con cobros reales.

---

## 0. Contexto verificado y distinción evidencia/hipótesis

- El cambio entre `9d3cc48` y `4cffce4` comprende dos commits y 17 archivos. La publicación del último SHA estuvo READY. Al consultar Vercel desde el deploy no aparecieron nuevos grupos de errores; las fallas anteriores de avatar y /admin correspondían a despliegues previos y no se extrapolan.
- **Sí corregido en código:** `proposal-composer.tsx` `<summary>` ahora está directamente en `<details>`; nuevo interstitial `confirm-completion-review.tsx` enseña importes y separa confirmación de pago; SQL de cron incorpora `FOR UPDATE SKIP LOCKED` y revalida status; ruta de apelación de autocierre visible; `settled_amount_minor` se usa en detalle; service worker v4 no cachea HTML personalizado; texto de pago fallido ya es neutro; OAuth del prestador oculto con pagos OFF; migración SQL `20261014090000` corrige ambigüedad 42702 en propuesta/alcance.
- **No probado en producción:** ejecución por dos cuentas autenticadas, migraciones recién agregadas `20261014080000` y `20261014090000`, resultados pgTAP contra proyecto real y capturas exhaustivas en móvil. Esas verificaciones deben ejecutarse en ambiente aislado con credenciales autorizadas. `docs/CONTEXTO.md` avisa de **58 migraciones históricas remotas que no están en el repo**: no hacer push automático.
- Este informe NO convierte la ausencia de GitHub Actions ni los cobros desactivados en problemas. La calidad se valida localmente/staging y la UX comunica correctamente la fase comercial.

## 1. Prioridades y contratos de aceptación

### Lote A — P1 imprescindible antes de considerar válido el ciclo del trabajo

**A1 · Corregir integralmente el código de cierre (seguridad y fiabilidad).**

- Código: `supabase/migrations/20261014080000_lote_ab_lifecycle_fix.sql`, `apps/web/src/app/(account)/jobs/actions.ts` (`requestCompletionAction`), `apps/web/src/lib/jobs/server.ts` (`transitionJob`).
- Falla CONFIRMADA por lectura: `record_confirmation_code_attempt(job,code)` sí persiste fallos en su propio RPC, pero `requestCompletionAction` llama a `transition_job_status` **directamente**, sin ejecutar el registrador. Este segundo RPC permite intentar códigos incorrectos sin incrementar contador. **Arreglar solo UI no es suficiente porque un cliente autenticado puede invocar RPC directamente.**
- Aceptación: un único **camino de autoridad en DB**, preferiblemente RPC específico de cierre que verifique estado/rol/código bajo locks, persista MISMATCH/LOCKED **sin hacer rollback**, y haga la transición SOLO para código válido. La ruta RPC vieja debe **rechazar** la transición de cierre o delegar a una autoridad que **no pueda esquivar el contador**. Nunca usar un GUC `set_config` controlable por el cliente como prueba de autorización.
- Cuidar lock ordering: el recorder viejo toma advisory→row, transition toma row→advisory: riesgo de deadlock. Unificar orden o reemplazar por transacción única.
- Casos obligatorios: 5 fallos en 10 min persisten; 6º bloqueado; acierto durante bloqueo sigue bloqueado; acierto fuera de bloqueo cierra una vez; duplicado/refresh no crea segundo evento; dos sesiones paralelas no hacen deadlock; acceso ajeno/anon denegado; DB RPC directo no evadible. **Los tests SQL actuales confirman explícitamente la evasión de la ruta vieja**: reemplazarlos por tests de integración real.
- No subir cambios SQL a producción sin permiso y procedimiento quirúrgico de migración/versionado, revisión pgTAP y backup/rollback probados.

**A2 · Alta de prestador sin bucle.**

- `apps/web/src/app/(provider)/provider/onboarding/page.tsx` renderiza, cuando NO existe `provider_profiles`, `NextStepBanner` con `href=/provider/onboarding/profile`. Pero esa página exige provider y redirige a `/provider/onboarding`. El botón `StartProviderForm` más abajo es el que crea el perfil.
- Sustituir por **un CTA principal único que ejecute `startProviderOnboarding`**; inmediatamente llevar a `/provider/onboarding/profile`. Un enlace a perfil solo después del alta. Estados pendientes/errores accesibles y sin doble submit.
- Pruebas: usuario recién registrado, perfil parcial, usuario rechazado con resubmisión, proveedor ACTIVE; teléfono 360/390.

**A3 · Notificaciones de cobro HONESTAS con `PAYMENTS_ENABLED=false`.**

- Migración `supabase/migrations/20261013090000_settlement_due_reminder.sql` programa `settlement-due-reminders` cada 6 horas y envía «Abrilo para completar el pago», imposible mientras checkout esté OFF.
- En app `apps/web/src/components/jobs/job-tracking.ts` `getJobNextAction` anuncia «Pagá el trabajo» aun sin pagos, mientras el botón real dice «Ver pendiente de pago».
- Mantener trazabilidad de saldo pero cambiar `heading/sub/CTA` a «Trabajo completado · pago online pendiente de habilitación», según rol; no insinuar que debe pagar ya ni mora. Suspender/programar condicionalmente la notificación de deuda hasta que checkout sea usable; preservar política futura por feature flag y configuración administrativa. La parada/activación del cron productivo exige autorización explícita y migración append-only segura.
- Pruebas con un trabajo `COMPLETED + DUE` de cliente y prestador, estando el flag OFF: ningún enlace vivo de cobro, ninguna notificación que ordene pagar en la app, reseñas siguen disponibles conforme a la política actual.

### Lote B — UX esencial del marketplace (sin dependencia de pagos)

**B1 · Propuestas y aceptación premium con errores recuperables.**

- `apps/web/src/app/(account)/messages/proposal-actions.ts`, `components/conversations/proposal-card.tsx`, `proposal-composer.tsx`.
- `respondProposalAction` lanza excepciones de servidor para `ACCEPT/REJECT/WITHDRAW`; formularios de card carecen de `useActionState`/`useFormStatus` consistente. Agregar pending y feedback inline por card, prevenir doble pulsación, preservar motivo de rechazo/counteroffer si falla; `409/expired/blocked` deben distinguirse con lenguaje humano. Revalidar propuesta al confirmar, indicar que contratar NO cobra al adelanto; no permitir aceptar oferta sin precio.
- Probar cliente proponente, prestador proponente, contraoferta, rechazo con motivo, mismo botón en dos pestañas, sesión expirada, revalidación rápida.

**B2 · Chat con desplazamiento y adjuntos sólidos.**

- `apps/web/src/components/conversations/conversation-thread.tsx`: al cargar mensajes anteriores conservar ancla/scroll exactos; en entrada nueva, autoscroll solo si el lector está cerca del final, mostrar «nuevos mensajes» si lee antiguos. Separadores de fecha, estado de subida/error visible (`role=alert` NO `sr-only` sin alternativa visual), progreso/cancelación o retry de archivos, mensajes duplicados y foco mobile. Evitar salto con teclado Android al abrir compositor/fotos. Mantener Supabase realtime/paginación.
- Ensayos: 100+ mensajes, scroll durante llegada de realtime, imagen grande, archivo erróneo, reconexión, envío doble y orientación móvil.

**B3 · Listados auténticos, no truncados.**

- `apps/web/src/app/(account)/jobs/page.tsx`: filtra `20/50` filas **después** de consultarlas. Algunas vistas aparentan vacías si los matches están fuera de esa ventana. Implementar filtrado/cursor en DB o paginación que recorra todos los resultados con el filtro. Estado `visible.length===0` no debe ocultar la posibilidad de continuar.
- `apps/web/src/lib/conversations/server.ts`: `getUnreadConversationCount` solo inspecciona primera página de 20. Sustituir por contador agregado seguro/RPC que respete usuario/participación.
- Pruebas: 55+ trabajos de varios estados, 30+ conversaciones, paginación al cambiar filtros e interacciones con unread count.

**B4 · Historial legible, onboarding claro y reseñas honestas.**

- `jobs/[jobId]/page.tsx`: no mostrar eventos técnicos como `Job auto completed`; mapa explícito a «YALO confirmó el cierre automáticamente» y similares; fecha local es-AR y actores correctos.
- `components/reputation/job-reputation-panel.tsx`: eliminar default global `5/5` e invitar a valoración deliberada; accesibilidad de ratings y prevención de accidentalidad. Comprobar reseñas con `COMPLETED` aun sin `SETTLED` (SQL permite este flujo hoy).
- `components/provider/skill-request-section.tsx` + query del manage: si habilidad es rechazada, mostrar motivo cuando proceda y verificar si hay índice anti-duplicado de solicitudes; evitar spam.
- En onboarding no dar por completada una etapa solo por contador; validarla por campos/documentos reales. Redactar CTAs más claros («Empezar», «Subir DNI», «Enviar a revisión») y dar progresión visible.

### Lote C — Calidad de datos/operación (NO activar cobros reales)

**C1 · Resumen del prestador y extras, sin fingir dinero liquidado.**

- `apps/web/src/app/(provider)/provider/manage/page.tsx` suma `settlement_total_minor` para trabajos `SETTLED`, que puede omitir adicionales incluidos y ya pagados; además usa hasta 50 por listado. El detalle de job ya usa `settled_amount_minor` derivado del intento `SUCCEEDED`.
- Diseñar read model agregado del ledger (fuente de verdad), bruto vs pendiente vs simulado, sin límite arbitrario y separando cobro en sandbox/admin de cobro real. Mientras OFF, mostrar saldos estimados como estimados y no poner «Cobrado» cuando no exista transacción real. Evitar regresión de privacidad SQL.
- `jobs/[jobId]` con adicionales `AWAITING_PAYMENT`: permitir acuerdo/documentación y explicar dependencia futura sin exigir pagos externos imposibles. No cambiar estados monetarios/DB silenciosamente.

**C2 · Señales de confianza correctas.**

- Fichas públicas: no afirmar «responde rápido» ni «experto certificado» si no hay dato/autoridad. Identidad verificada ≠ calidad/matrícula profesional; conservar esa distinción.
- Imágenes reales de servicios/prestador, descripciones suficientes, costes y disponibilidad. No inventar reviews, rating o ejemplos como contenido real.
- SEO de perfiles/servicios y rendimientos de imágenes. El rebranding no debe introducir más peso/JS que las páginas existentes.

**C3 · Pruebas sin Actions ni pago habilitado.**

- Ejecutar localmente `pnpm --filter @changas/web typecheck`, `pnpm --filter @changas/web lint`, `pnpm test`, `pnpm --filter @changas/web build` y tests SQL/pgTAP en entorno dev autorizado. Documentar PASS/FAIL y diferencias preexistentes.
- En staging o entorno aislado, usar dos cuentas reales con permisos distintos y fixtures temporales. No validar pretendidamente un SQL por mirar su texto o escribir `like '%...%'` en pgTAP: cubrir comportamiento efectivo, carreras y bypass por cliente adversario.
- Los cambios de marca no requieren GitHub Actions. La deuda de seguridad de paquetes no debe ignorarse: actualizar/validar dependencias manualmente en mantenimiento, sin tratar Actions como gate exigido.

---

## 2. Implementación visual YALO — orden de trabajo

### D0 · Activos y referencia del logo (sin correr código de app)

- Reconstruir el **símbolo YALO elegido**, no un nuevo logo de inspiración libre. Dot circular separado arriba, alas asimétricas cromáticas cian y verde, tronco teal y extremos redondeados. Wordmark ancho `YALO`, blanco/navy según fondo, tagline exacto «TRABAJÁ · CONTRATÁ · CRECÉ». Rehacer en SVG a trazos convertidos a paths, optimizado y sin fuente dependiente para el logo final. Pedir master al dueño si necesita fidelidad exacta; screenshot no basta para garantizarlo.
- Crear lockups dark/light/horizontal, isotipo standalone, monocromo, SVGs compactos, PNG 192/512/maskable, apple icon, favicon y OG. Revisar icon recortado por launcher Android. **No poner el boceto temporal del handoff como logo final**.
- Antes de lanzamiento con la marca, comprobar derechos del arte original, registro marcario, dominio y redes. No renombrar infraestructura sin autorización.

### D1 · Tokens + componentes centrales

- Nuevos tokens semánticos en `apps/web/src/app/globals.css`; preservar `dark` por clase, modo light/dark/system, scripts iniciales y safe area. Paleta exacta en [Brand System](../brand/yalo/YALO_BRAND_SYSTEM.md).
- Sustituir colores legacy y gradientes hardcoded (`#FF9A3D`, `#EE5A24`, `#FF6B35`, `#FF0A78`, `#FFC857`, backgrounds warm) por tokens; no hacer `sed` ciego. Comprobar superficies de form, input, alert, skeletons, focus y feedback.
- Components: `marketplace/service-card.tsx`, `illustrated-badge.tsx`, `status-chip.tsx`, `section-header.tsx`, `search-field.tsx`, `mobile-app-bar.tsx`, `authenticated-bottom-nav.tsx`, `desktop-nav.tsx`, `sticky-action-bar.tsx`, `conversation-thread.tsx`, `proposal-card.tsx`, `job-tracker.tsx`, `provider-payment-account.tsx`.
- Sombra suave y profundidad selectiva, evitar «neón/gradiente por todas partes». CTA primaria navy con blanco o claro adecuado sobre navy. Las advertencias/errores no dependen del gradiente de marca.

### D2 · Pantallas completas, sin inconsistencias

**Cliente:** `/` home/hero, `/buscar`, categorías, detalle de servicio `/p/[slug]/[serviceSlug]`, perfil `/p/[slug]`, login/sign-up, favoritos, inbox, chat y propuestas, trabajos y detalle de tracking, reseña, cuenta/settings/notificaciones. Una llamada a la acción clara en cada etapa.

**Prestador:** alta perfil/identidad/documentos/review, gestión de servicios/portfolio/habilidades/agenda, cotización, seguimiento, visibilidad de reputación, resumen honesto de saldos y notificaciones. No mezclar estilo administrativo legado con consumer por accidente: documentar área admin intencionada, pero mantener legibilidad/estados.

**PWA y branding oculto:** `apps/web/src/app/layout.tsx`, `manifest.ts`, `icon.svg`, `apple-icon.png`, `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `public/icon-*.svg`, `public/screenshots/*`, `opengraph-image.tsx` (global y proveedor), `public/sw.js`, install prompt, `/offline`, title/OG, robots/sitemaps cuando correspondan. Actualizar push/email y notificaciones **solo en textos**, conservar permisos y rutas técnicas. Versionar assets/PWA y probar desinstalación/reinstalación/refresh.

### D3 · Renombrar textos públicos, no ids operativos

Buscar `Changas`, `CHANGAS`, `changas` y colores antiguos; clasificar hallazgos:

1. **Marca pública:** cambiar a YALO.
2. **Texto histórico/legal/administrativo:** revisar con cuidado, conservar razones sociales verdaderas.
3. **Identidad técnica estable:** NO renombrar `@changas/*`, paquetes, nombres DB, rutas, env keys, cron, secretos, scope OAuth, callback, prefijos de storage ni cookies de sesión. `changas-theme` es key de preferencia instalada: compatibilidad de lectura/migración antes de cambiarla.
4. **URLs actuales:** aún no hay dominio nuevo; mantener `changas-web-gray.vercel.app`, `getPublicSiteUrl()`, verificaciones OAuth y cron hasta decisión explícita. Si se obtiene dominio nuevo, crear proyecto separado de migración SEO/canonical/redirect/auth/push.

---

## 3. Matriz de QA obligatoria (manual + pruebas)

| Caso              | Cliente                                  | Prestador                   | Resultado esperado                                        |
| ----------------- | ---------------------------------------- | --------------------------- | --------------------------------------------------------- |
| Primer registro   | Busca → ficha → consultar → login → chat | Alta desde CTA principal    | Sin bucles; contexto conservado                           |
| Negociación       | Solicita cotización/rechaza/contraoferta | Cotiza/revisa/acepta        | Estados mutan una vez, errores inline                     |
| Contratación      | Acepta precio y alcance                  | Recibe `CONFIRMED`          | **Sin adelanto**, estado consistente en ambas cuentas     |
| Inicio/agenda     | Ve inicio, fecha y chat                  | Inicia, reprograma          | Roles correctos; información privada protegida            |
| Extras            | Acepta/rechaza cambios                   | Propone alcance y adicional | Sin exigencia de pago imposible cuando OFF                |
| Código de entrega | Consulta código privado                  | Envía código                | Límite de 5 real; sin bypass RPC ni deadlock              |
| Cierre            | Ve base/extras/total y confirma          | Recibe cierre               | Confirmación no cobra; estados correctos                  |
| Autocierre        | Puede apelar si corresponde              | Ve disputa/resultado        | No pisa cancelado/disputa; reloj y elegibilidad correctos |
| Cobro OFF         | Ve saldo pendiente y mensaje honesto     | Ve deuda sin «cobrado real» | No enlaces OAuth/checkout ni notificaciones falsas        |
| Reseña            | Puede valorar trabajo terminado          | Responde y ve reputación    | No default 5; sin depender de liquidación                 |
| Escala            | 51+ trabajos, 25+ conversaciones         | Igual                       | Filtros reales y badges agregados                         |
| UI móvil          | 360/390/412 Android, teclado y nav       | Igual                       | Sin cortes, CTAs táctiles, safe-area                      |
| Accesibilidad     | Luz/oscuro/sistema, zoom 200%, teclado   | Igual                       | WCAG AA target; foco, contraste, alerts                   |
| Identidad         | PWA/install/icon/OG/nav dicen YALO       | Igual                       | Cero mezcla visual/textual de Changas/YALO                |

Casos negativos extra: usuario anon en `/jobs` debe ir a login, no pantalla de error; usuario sin permisos no accede a trabajo, código ni documentos privados; reconectar realtime no duplica mensajes; logout A → login B no sirve HTML de A desde el SW.

## 4. Qué entregar en el PR de Muse

1. Revisión visual comparativa por pantallas y dispositivo (capturas móvil/desktop light/dark); fuente de referencia YALO anexada por el dueño del proyecto, reconstrucción vectorial final identificada y licencias confirmadas.
2. Tabla `archivo → cambio`, migraciones append-only propuestas y **estado de aplicación real**; PR separable por lotes A/B/C/D, sin desplegar SQL ni tocar main en automático.
3. Salida de typecheck/lint/test/build **local**, lista de fallos existentes distinguidos de nuevos, prueba manual de ambos roles con timestamps y logs.
4. Nuevos tests para bypass de código por RPC, deadlock, retry de propuestas, filtros y PWA, más inspección de accesibilidad y rendimiento real.
5. Capturas de iconos PWA adaptativos Android, navegación y transparencia; contrastes comprobados.
6. Texto final de UI «cobros online aún no disponibles» y comprobación del cron en el entorno en que se vaya a publicar. Nada de cobros reales.

**Criterio global de finalización:** un visitante reconoce YALO en todas las superficies públicas, el cliente puede contratar y completar sin saltos inesperados, el prestador puede darse de alta y finalizar sin bucles, un atacante no puede forzar el código saltándose límites, las pantallas no prometen pagos que no están disponibles y todo funciona fluidamente en móvil. No se considera completado basándose únicamente en PR merged o `build` verde.

---

## 5. Orden operativo recomendado

1. **A1 y A2**, con pruebas reproducibles, antes de hacer cambios masivos de CSS.
2. **A3 + B1**, asegurar la confianza/contratación y el modo sin pagos reales.
3. **B2/B3/B4 + C1/C2**, experiencia/chat/datos y estabilidad; pruebas locales.
4. **D0 vector definitivo + D1 tokens**, aprobar activos antes de sustituir iconos.
5. **D2/D3**, convertir todas las pantallas y metadata, sin mezclar paletas.
6. QA integral con dos sesiones, accesibilidad, smoke Android/PWA y revisión de regresiones; entregar PR para revisión humana.

**Recordatorio clave:** el archivo `docs/design/changas-brand-system.md` pasa a ser **archivo histórico** cuando el rebrand se materialice; referenciar esta guía YALO como fuente vigente. No editar el antiguo sistema de marca silenciosamente, ni dejar que dos especificaciones se disputen las reglas del UI.
