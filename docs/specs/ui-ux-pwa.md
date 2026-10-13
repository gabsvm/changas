# Feature Spec — UI/UX PWA Changas

> **Estado:** Borrador
> **Producto:** `docs/PRODUCT.md` (Borrador 2026-10-13)
> **Propietario del alcance:** propietario (nada confirmado en esta sesión)

## 1. Problema y resultado esperado

La auditoría UI/UX de `apps/web` (shell PWA, flujos cliente, auth/cuenta/proveedor/admin) encontró 2 bugs P1 confirmados —copy de dinero engañoso y texto invisible en dark— ya corregidos en esta entrega, más un backlog P2/P3 que degrada contratación, chat, jobs y accesibilidad. Este spec cataloga cada hallazgo con severidad, tipo (Confirmado / Riesgo fundamentado / Mejora opcional) y criterio de aceptación verificable, y lo asigna a olas: **Now** (P1 restantes + quick-wins CSS), **Next** (P2 estructurales), **Later** (P3). No se implementa nada fuera de la ola aprobada.

Modo de referencia: **Estándar** (impacto negocio visible, reversible). Lo Crítico (dinero retenido inexistente, borrado irreversible) se marca donde aplica.

## 2. Actores y caso principal

- **Usuario/rol:** visitante, cliente, proveedor, admin (ver PRODUCT §2).
- **Disparador:** cualquier uso de la PWA instalada o del sitio móvil.
- **Camino feliz:** descubrir → consultar → propuesta con fechas visibles → aceptar (= contratar) → tracking con código → confirmar viendo el monto → pagar al cierre → reseñar, con notificaciones que llegan y errores que se entienden sin perder contexto.

## 3. Alcance explícito

**Incluye (esta entrega):**

- Corrección de los 2 P1 confirmados (copy escrow + `.button-primary` dark) y panel de precio condicional por `price_model` (misma superficie).
- Este spec con todo el backlog priorizado y criterios Dado/Cuando/Entonces.

**Fuera de alcance:**

- Implementar las olas Now/Next/Later sin aprobación del propietario.
- Reglas de negocio nuevas, retenciones/escrow, email, cambios de lifecycle de jobs.
- Re-auditorías integrales por cada fix (regla de cierre AGENTS §6: delta + regresiones cercanas).

## 4. Reglas de negocio e invariantes

- Nunca prometer retención, custodia, liberación de fondos ni comisión descontada antes de pagar al proveedor (modelo: sin pago upfront, cobro al cierre por checkout MP).
- "Total a pagar" solo para `FIXED`; resto de modelos = precio de referencia.
- Confirmar finalización genera obligación de pago: requiere monto visible antes del tap.
- Borrado de cuenta y acciones de dinero mantienen confirmación explícita.
- Fortalezas que NO deben regresionar (ver §9): SW nunca cachea rutas privadas; push opt-in con reversión; email honesto deshabilitado; foco visible + reduced-motion + inputs ≥16px; retorno MP diferenciado; discovery con append acumulativo; borrado con contraseña + ELIMINAR; verificación con disclaimer.

## 5. Criterios de aceptación verificables — Ola Now (P1 + quick-wins)

### P1 ya corregidos en esta entrega

- [x] Dado el perfil público, cuando leo el footer, entonces dice "Sin pago por adelantado…" y no menciona retención (`p/[slug]/page.tsx:579`).
- [x] Dada la página de servicio, cuando leo la tarjeta de garantía y el desglose, entonces no existe "retenidos/liberar" (`[serviceSlug]/page.tsx:323,246-250`).
- [x] Dado un servicio no-`FIXED`, cuando miro el panel de precio, entonces veo "Precio de referencia — el total se acuerda en la propuesta" y no "Total a pagar" (`[serviceSlug]/page.tsx:217-245`).
- [x] Dado dark manual, cuando se renderiza `.button-primary`, entonces el texto es legible (override que lo volvía tinta eliminado de `globals.css:907-910`).

### P1 restante (riesgo, validar en runtime)

- [ ] **[P1 · Riesgo] SW sirve home personalizada desde caché.** `sw.js:25` incluye `/` en `SWR_PATHS` y `:78-93` sirve caché sin distinguir sesión; `app/page.tsx:28` es `force-dynamic` con saludo (`:49-59`). Dado un login→home→logout, cuando se carga `/` online y offline, entonces no se muestra el saludo de la sesión anterior.

### Quick-wins CSS/PWA (Now)

- [ ] `viewportFit: "cover"` en `layout.tsx:39-45`; Dado iPhone con notch, cuando se abre la app instalada, entonces el contenido respeta el safe-area (`globals.css:74-77,431-438,504-518` dejan de ser inertes).
- [ ] `id="main-content"` en `error.tsx:21`, `not-found.tsx:7`, `offline/page.tsx:9`; Dado teclado/lector, cuando activo "saltar al contenido", entonces el foco cae en el main.
- [ ] Contraste gradiente naranja→rosa con texto blanco (`desktop-nav.tsx:9`, `category-chip.tsx:20`, `authenticated-bottom-nav.tsx:198`): Dado el CTA sobre gradiente, cuando se mide, entonces cumple el token del brand doc (hoy [INFERENCE] ≈2,9–3,4:1) o cambia a tinta sobre naranja según §8 de PRODUCT.
- [ ] Badge dark: Dado dark, cuando hay conteo no-leído, entonces el badge (`--color-brand-pink-strong`→`#f0438a` en `globals.css:829` + texto blanco 11px) alcanza contraste legible.
- [ ] Precache: Dado `sw.js:5-13,28-32`, cuando se instala el SW, entonces los screenshots del manifest no están en `cache.addAll` (un 404 no aborta toda la instalación).
- [ ] `.skeleton-shimmer` (`globals.css:332-343`, usado por `skeleton.tsx:4`): Dado dark, cuando hay skeletons, entonces no hay destello claro sobre fondo oscuro.

## 6. Criterios — Ola Next (P2 estructurales)

### Chat y propuestas

- [ ] Anclaje de scroll (`conversation-thread.tsx`, sin `scrollIntoView`): Dado un hilo con historial, cuando lo abro, entonces la vista parte en el mensaje más reciente; y cuando toco cargar anteriores (`loadOlder:190-209`), entonces se preserva la posición (delta de `scrollHeight`).
- [ ] Error de adjunto visible: Dado un fallo de subida, cuando miro la pantalla, entonces veo el error inline (hoy `sr-only` en `:838-842`).
- [ ] Push priming al destino correcto: Dado el CTA "Avisame cuando responda" (`:405-418`), cuando lo toco, entonces llego a `/account/settings/notifications` (hoy `/account/notifications`, centro sin toggles).
- [ ] Horarios en la tarjeta aceptada: Dada una propuesta con `scheduleStartAt/EndAt` (`proposal-composer.tsx:94-109`, persistidos en `lib/proposals/server.ts:50-51`), cuando la veo para aceptar (= contratar), entonces la tarjeta muestra el rango de fechas (`proposal-card.tsx:137-192` hoy no lo renderiza).
- [ ] Aceptar con `useActionState`: Dado un ACCEPT fallido (vencida, estado cambiado), cuando falla, entonces veo error inline con motivo y el botón queda disabled en pending (hoy cae a `segment-error.tsx` genérico y permite doble-submit; idempotencia no verificada).

### Jobs

- [ ] Historial en español con transición: Dado el historial (`jobs/[jobId]/page.tsx:100-103,1013-1015`), cuando hay eventos `JOB_STATUS_CHANGED`, `JOB_CONFIRMED`, `SCOPE_CHANGE_ACCEPTED`, `JOB_SETTLEMENT_SUCCEEDED`, `JOB_AUTO_COMPLETED`, entonces leo etiquetas ES con transición `from → to` (hoy "Job status changed" sin estado).
- [ ] Tabs con paginación real: Dados >50 trabajos o filtro sin match en primera página (`jobs/page.tsx:111-121,205-213,299-306`; clamp en `lib/jobs/server.ts:258-272`), cuando filtro o pido más, entonces alcanzo todos los datos (filtro en servidor o paginación real; mínimo: "Mostrar más" visible también con `visible.length===0`).
- [ ] Interstitial de confirmación con monto: Dada la finalización pendiente (`page.tsx:1177-1185` + sticky `:1033-1055`), cuando toco confirmar, entonces veo el total DUE y un CTA "Confirmar y pagar $X" antes del envío (hoy 1 tap).
- [ ] "Nuevo total" solo cuando aplica: Dado un scope-change PAID/REJECTED (`page.tsx:805-822` vs `total_price_amount` en `:181-184,543-547`), cuando lo miro, entonces no veo un cálculo duplicado (solo OPEN/AWAITING_PAYMENT muestran la suma).
- [ ] Errores inline en acciones de job: Dado un fallo de reschedule/scope/review (`jobs/actions.ts:92-108,143-161,176-188,328-335`), cuando falla, entonces veo error inline sin perder el input (patrón `useActionState` como `requestCompletionAction:115-141`).
- [ ] Rehire con interstitial: Dado "Volver a contratar" en COMPLETED (`job-reputation-panel.tsx:113-120`, `jobs/actions.ts:328-335`), cuando lo toco, entonces veo "Se crea una propuesta nueva en el chat" y un fallo muestra error inline (semántica con settlement DUE sin verificar: no afirmar).

### Inbox y notificaciones

- [ ] Inbox "sin leer" global: Dado el filtro unread (`messages/page.tsx:115-120,226-233`), cuando hay no-leídos en páginas siguientes, entonces el conteo es global (`getUnreadConversationCount` ya existe) y "Mostrar más" no desaparece con `visible.length===0`.
- [ ] Centro de actividad global: Dada la paginación (`account/notifications/page.tsx:63-70,197-204`), cuando avanzo el cursor, entonces el conteo de no-leídas es global (badge en `nav-with-counts.tsx:20-23`) y lo leído no se pierde (acumular o link de retorno).
- [ ] Abrir marca leída: Dada una notificación (`:154-159`), cuando navego por su `actionUrl`, entonces queda marcada leída sin segundo gesto.

### Auth, cuenta, proveedor

- [ ] Errores de form con campo y foco: Dado un error de validación (`(auth)/actions.ts:37-39` descarta el específico de `packages/validation/src/index.ts:40-43`), cuando falla, entonces el mensaje nombra el campo, lo enlaza con `aria-describedby`/`aria-invalid` (`form-field.tsx:22-37`) y mueve el foco.
- [ ] Identidad marca obligatorios: Dados los 5 datos exigidos (`account-form.tsx:172-226` vs schema `:66-92`), cuando veo el formulario, entonces los obligatorios están marcados.
- [ ] Onboarding honesto: Dado el progreso (`lib/ui/onboarding.ts:56-63` vs revisión `review/page.tsx:112-121`), cuando falta bio o datos, entonces no veo 100% antes de enviar.
- [ ] Eliminar con confirmación: Dado eliminar en `manage` (`marketplace-management.tsx:221-232,890-894,1001-1006`), cuando toco eliminar, entonces pide confirmación (patrón `<details>` de `admin/catalog/page.tsx:373-376`).
- [ ] Uploader conserva tipo: Dada una subida de documento (`document-uploader.tsx:23-38`, `documents/page.tsx:142-146`), cuando completo una cara, entonces el selector no resetea a `DNI_FRONT`.

## 7. Criterios — Ola Later (P3)

- [ ] Toggle "Cerca mío" → "Presencial" (`categoria/[slug]/page.tsx:216`; es modalidad, no distancia).
- [ ] Guía "sin filtros" fuera del grupo "Filtros activos" (`buscar/page.tsx:340-344`).
- [ ] `DiscoveryPagination` muerto (`discovery-pagination.tsx:3`): borrar o adoptar (categoría/buscar usan `DiscoveryResults`).
- [ ] Métricas formateadas: "480 min" → "8 h" (`[serviceSlug]/page.tsx:198-204`); "5000 m" → "5 km" (`p/[slug]/page.tsx:467`).
- [ ] Label "Propuestas" con valores "Acepta/Precio fijo" → "Precio: negociable/fijo" (`[serviceSlug]/page.tsx:206-209`).
- [ ] Favorito y compartir en página de servicio (hoy solo en perfil `p/[slug]/page.tsx:232-268`); quitar favorito inline en lista (`favorites/page.tsx:64-93`).
- [ ] Separadores de fecha en chat (hoy solo hora:minuto en `conversation-thread.tsx:540-543`).
- [ ] Selects de reseña sin pre-selección en 5 (`job-reputation-panel.tsx:43-60`).
- [ ] Banner "Dejá tu reseña" alineado con la next-action (`jobs/[jobId]/page.tsx:231-243` vs `job-tracking.ts:186-195`).
- [ ] `autocomplete="street-address"` en dirección exacta (`jobs/[jobId]/page.tsx:975-981`).
- [ ] "Olvidé mi contraseña" conserva `next` (`auth-form.tsx:235-255`).
- [ ] Ayuda para lat/long en zonas de cobertura (`marketplace-management.tsx:1304-1332`).
- [ ] Botón cerrar del install-prompt a 44px mínimo (`install-prompt.tsx:148`).
- [ ] `ThemeSelector` consistente con default Claro (`theme-selector.tsx:19-27,40-42` vs `layout.tsx:47-48`); `themeColor` sigue tema manual (`layout.tsx:40-43`).
- [ ] Tablas admin con overflow móvil (`admin/identity/page.tsx:257`, `providers/page.tsx:179`, `users/page.tsx:190`).
- [ ] Offline con listener `online` para reintentar (`offline/page.tsx:43-49`); banner de update con "Más tarde" (`service-worker-register.tsx:120-129`); banners PWA no superpuestos (`service-worker-register.tsx:71`, `install-prompt.tsx:110`); prompt iOS no inmediato en primera visita (`install-prompt.tsx:71-79`); imágenes cache-first con TTL (`sw.js:98-113`).

## 8. Riesgos a validar en runtime (no afirmados como hallazgos)

- Scroll/foco real del chat en device; doble-submit e idempotencia de ACCEPT, confirm-completion y checkout; placeholder "Preparando adjunto…" huérfano (`conversation-thread.tsx:531-535`); toggle del `<details>` anidado en Safari móvil (`proposal-composer.tsx:27-36`); tiempos del webhook MP tras retorno; entrega push real; knob del Switch (`switch.tsx:33-35`); tablas admin a 360px; cuenta solo-Google sin contraseña en borrado; "responde rápido" sin métrica (`[serviceSlug]/page.tsx:338-340`); reprogramar en `IN_PROGRESS` (¿regla o faltante?); semántica de rehire con settlement DUE.

## 9. Fortalezas — no regresionar

- SW nunca cachea rutas privadas (`sw.js:16,60-64,123-139`); push opt-in robusto con reversión (`push-opt-in.tsx:109-245`); email honesto deshabilitado (`lib/ui/account-settings.ts:48-54`); foco visible, reduced-motion, inputs ≥16px, zoom habilitado (`globals.css:143-163,1043-1056`); retorno MP honesto success/failure/pending (`payments/return/*`); discovery con append + retry + `aria-live` (`discovery-results.tsx:149-169,259-302,473-491,356-366`); borrado con contraseña + ELIMINAR; verificación con disclaimer (`p/[slug]/page.tsx:305-310`); badges globales SSR (`nav-with-counts.tsx:8-30`); ubicación con privacidad y fallback manual.

## 10. Dependencias y riesgos conocidos

- Sin Docker local: pgTAP solo en CI. Sin `.env.local` en esta máquina (secreto): el dev local da 500 en `/` por falta de env Supabase — esperable, no bug.
- Validación visual real requiere device iOS/Android (safe-area, install prompt, `<details>` Safari) y staging con webhook MP.
- Modo Estándar por impacto visible y reversibilidad; los ítems de dinero (P1 copy, interstitial) se tratan con rigor Crítico puntual.

## 11. Decisiones pendientes que sí cambian la implementación

- CTA primario naranja vs tinta (PRODUCT §8) — propietario.
- Conteo global de no-leídos: ¿RPC existente o nuevo endpoint? — técnico reversible.
- Filtro de jobs en servidor: ¿parámetro de estado en el RPC o paginación cursor real? — técnico reversible.

## 12. Evidencia de cierre (esta entrega)

 - **Tests ejecutados:** `pnpm --filter @changas/web typecheck` OK (0 errores); `pnpm --filter @changas/web lint` OK; `pnpm test` → 84 archivos, 410 tests verdes (2026-10-13).
 - **Validación manual/entorno:** producción 200 en `/`, `/buscar`, `/offline`, `/login`, `/terminos` (curl 2026-10-12); dev local sin env → 500 esperable en `/`, no bug.
 - **Ronda emulador 2026-10-13 (producción, cuenta admin+vendedor):** login, push opt-in ("Push activado en este dispositivo"), crear servicio, crear categoría, proponer + aprobar skill, publicar 2 servicios, perfil público con 2 servicios — todo verificado con screenshots. Límite: sin cuenta Google no hay WebAPK (`appinstalled` nunca dispara; `beforeinstallprompt` sí).
 - **Fixes ronda emulador:** `SkillRequestForm` deja `<details>` controlado por `<button aria-expanded>` con indicador de abierto y auto-apertura por `#proponer-habilidad`; CTAs "Publicar servicio"/"Ver mis servicios" → `/provider/manage#servicios` y "Conectar Mercado Pago" → `#cobros` (tab inicial lee el hash + `scroll-mt` existente); checkboxes del form a 24px (`h-6 w-6`); "Olvidé mi contraseña" preserva `?next=`.
 - **Barrido visual 2026-10-13 (todas las secciones en emulador):** header duplicado "Servicios publicados"/"Resultados" en categoría (se quitó el de la página); tablas admin con scroll horizontal (`min-w-[640px]` en usuarios/identidad/prestadores); "Cerca mío" → "Presencial"; pluralización métricas admin; Zonas con botón "Usar mi ubicación" + placeholders y teclado decimal; día de disponibilidad como select (antes número 0-6) y zona horaria oculta; listado de reglas muestra nombre del día.
 - **Preview 2026-10-13 (`ux/pulido-emulador`, verificado en emulador):** categoría sin header duplicado + chip "Presencial"; Zonas con botón y placeholders; Disponibilidad con select "Lunes"; GPS con mock (`geo fix`) autocompleta latitud; sin mock muestra el error honesto. Límite: Chrome colgó con 38 tabs (force-stop, no relacionado a la app).
 - **Spotlight de chat 2026-10-13 (rama `ux/spotlight-chat`, verificado en preview con contratación real):** tira fija estilo Rappi en el header del chat — propuesta OPEN muestra "Contratar · $X" (ancla a #propuestas), trabajo activo muestra estado + paso + próxima acción con "Ver seguimiento". Título final: solo estado ("Pendiente de cierre"), sub con paso y acción.
 - **Resultado:** APROBAR CON OBSERVACIONES (backlog Now/Next/Later pendiente de aprobación).
