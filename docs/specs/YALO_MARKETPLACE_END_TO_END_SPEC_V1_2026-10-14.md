# YALO — SPEC FUNCIONAL V1.0

## Marketplace dual · contratación · ejecución · entrega · pagos externos declarados

**Fecha:** 14 de octubre de 2026 · **Estado:** especificación de producto aprobada en sus 4 decisiones base; implementación por etapas sujeta a auditoría/QA · **Destinatario:** Muse Code.
**Repositorio:** gabsvm/changas · **Base auditada:** main en `14b413a1e2e50a33e246c186645322b4deff27f2`, PR #22 fusionado, producción Vercel READY.
**Documentos de base:** `docs/audits/2026-10-14-YALO-MUSE-HANDOFF.md`; `docs/brand/yalo/YALO_BRAND_SYSTEM.md`; investigación comparativa del 14/10/2026 entregada como `YALO_RESEARCH_RAPPI_PEDIDOSYA_UBER_SPEC_V0_2026-10-14.md`. El viejo master plan de Changas es referencia histórica; ESTE SPEC define el comportamiento de YALO para estos flujos y no autoriza cambios silenciosos a otros dominios.
**No merge ni despliegue automático:** este documento es el contrato para implementar y probar mediante PRs pequeños. No modificar SQL productivo sin migración append-only, plan de aplicación, pruebas y aprobación. Mantener pagos en línea deshabilitados; no depender de GitHub Actions.

---

# 0. DECISIONES DEFINITIVAS DE PRODUCTO (D1–D4)

| ID  | Decisión del propietario                                      | Consecuencia obligatoria                                                                                                                                                         |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **C. Dos sistemas de contratación**                           | (A) cliente elige un servicio/prestador y (B) cliente publica una necesidad y recibe ofertas de varios prestadores. Ambos convergen en UN contrato/trabajo.                      |
| D2  | **B. Reserva directa cuando se puede; negociación cuando no** | Un servicio fijo y previamente habilitado puede contratarse al instante; el resto exige propuesta/confirmación. Nunca simular disponibilidad ni aprobación del prestador.        |
| D3  | **B. PIN presencial; entrega/verificación digital remota**    | El PIN prueba la entrega/interacción presencial, NO significa automáticamente satisfacción ni pago; en remoto se usan evidencias digitales y aprobación del cliente.             |
| D4  | **C. Pagos externos y declaración de pago**                   | Efectivo/transferencia/acuerdo directo fuera de YALO; ambas partes pueden informar y conciliar lo abonado, pero YALO no recibe, procesa, garantiza ni verifica fondos bancarios. |

**Restricciones vigentes:** una misma cuenta puede ser cliente y prestador; contratar NO obliga a pagar por adelantado; YALO no cobra online aún (`PAYMENTS_ENABLED=false` en aplicación, `payments_online=false` en Supabase); las simulaciones admin no constituyen cobro; no se exige GitHub Actions; nombre público YALO, no Changas.

**Precisiones que completa este SPEC:** en reserva directa el prestador puede otorgar autorización anticipada específica para servicio+agenda+capacidad+precio y así prescindir de segunda aceptación manual; si falta esa autorización, el CTA es «Solicitar contratación» y queda en espera de aceptación, no «Reservado». Toda contratación guarda una versión inmutable de las condiciones.

# 1. OBJETIVO DE EXPERIENCIA

**Promesa operacional:** «Sé qué pedí, quién responde, qué acordamos, qué sigue, si terminó y si el pago externo está confirmado por las partes».

Cinco preguntas siempre respondidas en la vista principal de cada solicitud/trabajo:

1. **Qué**: servicio, descripción, alcance y extras aprobados.
2. **Con quién**: contraparte verificable y modalidad.
3. **Cuánto**: precio acordado y saldo externo, distinguiendo declarado/confirmado.
4. **Cuándo**: fecha/hora/zona o «A coordinar»; no ETA inventado.
5. **Qué sigue**: responsable, acción primaria, límites de tiempo y ayuda.

**Las cinco entidades NO son lo mismo:**

- `Service` = oferta publicada por un prestador;
- `ServiceRequest` = necesidad del cliente, dirigida o abierta;
- `Proposal/ProposalVersion` = términos económicos y de alcance propuestos;
- `Job` = acuerdo contratado con snapshot aceptado;
- `ExternalPaymentRecord` = declaración/confirmación sobre movimiento ajeno a YALO.

**Una consulta no es contratar. Enviar presupuesto no es contratar. Aceptar una propuesta contrata. PIN no es evaluación de calidad. Completar no implica recibir dinero. «Ya pagué» no implica «pago confirmado».**

### Principios de referencia comparativa

Según documentación pública ya recopilada:

- **PedidosYa:** revisar pedido/total antes de confirmar, aceptación visible, progreso y PIN después de entrega completa.
- **Uber:** acción dominante y contextual por estado/actor; conductor informado, identificación, trayectoria y valoración; PIN de Uber es de INICIO del viaje y NO se copia como PIN de cierre de trabajo.
- **Rappi:** modificaciones/alternativas proactivas pero con aprobación de quien contrata; hitos y resolución de imprevistos.
  Fuentes oficiales consultadas en la investigación: [Uber Argentina](https://www.uber.com/ar/es/about/how-does-uber-work/), [Uber conductor](https://www.uber.com/ar/es/drive/basics/how-to-take-trips/), [Uber PIN](https://help.uber.com/es/riders/article/what-is-verify-your-trip?nodeId=9a2a4bc6-002b-4461-8e9e-8ea29974795d), [PedidosYa términos](https://www.pedidosya.com.ar/about/terminos-condiciones), [Rappi Argentina](https://legal.rappi.com/argentina/terminos-y-condiciones-rappi-2/) y [Soy Rappi](https://legal.rappi.com/argentina/terminos-y-condiciones-rappitenderos-3/). No afirmar paridad de interfaz en tiempo real ni universalidad por país.

# 2. SISTEMA A — CLIENTE ELIGE PRESTADOR (ACTUAL + MEJORAS)

## A1. Descubrimiento

Pantallas: Inicio `/` → `/buscar` / categoría → perfil `/p/[slug]` → ficha `/p/[slug]/[serviceSlug]`.

- Puede explorar sin login, comparar servicios, categorías, precio y confianza; al iniciar acción autenticada se conserva deep-link/intención durante login.
- Mostrar: título, especialidad, modalidad, zona pública aproximada (no dirección), precio bien rotulado (fijo / por hora / desde / a cotizar), condiciones incluidas/excluidas, duración si estimada, reputación proveniente de trabajos verificados.
- «Identidad verificada» no equivale a «matrícula profesional» o garantía de calidad; no fabricar reseñas, disponibilidad, tiempos de respuesta ni casos reales.

## A2. Decisión según tipo de servicio (regla, NO inferencia de texto)

| Condición real validada en DB                                                                                                               | CTA cliente                                                            | Resultado                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Precio FIJO + `instant_booking_enabled` + disponibilidad preautorizada y capacidad reservable + sin campos/visita que requieren negociación | **«Reservar por $X»** → revisar condiciones → confirmar                | Crear `Job CONFIRMED` inmediatamente, atómico e idempotente.                      |
| Precio FIJO sin disponibilidad preautorizada o requiere elegir hora/alcance                                                                 | **«Solicitar contratación»**                                           | Solicitud pendiente → prestador acepta o propone cambio → confirmación bilateral. |
| Precio hora/unidad/desde/con visita o precio desconocido                                                                                    | **«Pedir presupuesto»**                                                | Consulta estructurada; conversación y propuesta.                                  |
| Prestador no está aprobado / servicio suspendido / bloqueado / fuera de cobertura                                                           | CTA deshabilitado con explicación contextual o alternativa de búsqueda | NUNCA crear trabajo.                                                              |

El `DIRECT_BOOKING` existente actualmente crea `ACCEPTED + CONFIRMED` en el SQL de `20261010000000_hire_on_accept.sql` con solo `price_model=FIXED`. **P0 DE CONGRUENCIA:** endurecer este camino para exigir autorización anticipada y reservar capacidad; si falta, usar solicitud NO autoaceptada. Ningún usuario puede autoaprobar una contratación ajena mediante RPC directo.

## A3. Formulario previo (máximo 1 pantalla + confirmación)

Pedir solo información que varía el trabajo: problema/tarea concreta, modalidad, zona aproximada, disponibilidad preferida, fotos opcionales, notas de acceso privadas solo tras aceptar si presencial. Prellenar categoría y servicio. No exigir fotos ni precio que el cliente no conoce.

- Tras «Enviar solicitud»: pantalla tarjeta **«Solicitud enviada»**, fecha, resumen, identidad de quien debe contestar, botón **«Ver conversación»**; no enviar a chat vacío sin contexto.
- Si cotiza el prestador: tarjeta de propuesta versionada, total, qué incluye, qué excluye, fecha/vencimiento. Acciones: **«Aceptar y contratar»**, «Contraofertar», «Rechazar». Registrar razón opcional, errores recuperables.
- Si contrato inmediato: mostrar **«Trabajo confirmado»**, el resumen aceptado, contacto y siguiente paso.

# 3. SISTEMA B — EL CLIENTE PUBLICA NECESIDAD (NUEVA FUNCIÓN; NO EXISTE EN MAIN)

## B1. Entrada y creación

Nuevo CTA «Publicar lo que necesitás» desde inicio/búsqueda y una sección «Mis solicitudes».
**Wizard móvil corto de 3 pasos con borrador autosalvado:**

1. **Qué necesitás:** categoría/habilidad, título claro, descripción, fotos/adjuntos opcionales, remoto/presencial, urgencia solo como dato de necesidad (sin promesa SLA).
2. **Dónde y cuándo:** zona aproximada o remoto, fechas preferidas o flexible, tipo de cita/plazo. Nunca publicar dirección exacta, teléfono, DNI, correo ni fotos con datos privados sin advertencia.
3. **Revisar y publicar:** alcance y privacidad, presupuesto opcional como _orientativo_ (nunca precio final), vigencia del anuncio, botón «Publicar solicitud».

**Entrada no autenticada:** guardar borrador local de forma no sensible o en sesión efímera y recuperarlo tras login; limitar persistencia de imágenes privadas. Validar categoría activa y cobertura geográfica; confirmar publicación con enlace a la solicitud.

## B2. Difusión a proveedores

- Mostrar la solicitud a proveedores `ACTIVE`, con habilidades correspondientes, modalidad/zona admisible, y que no estén bloqueados/suspendidos; una solicitud PUBLIC no implica datos personales públicos.
- Inbox de oportunidades para proveedor: «Para vos», filtros habilidad/zona/modalidad/plazo, portada/alcance, fecha, rango presupuestario indicado y CTA **«Enviar propuesta»** o «No me interesa».
- NO auto-enviar DM ni revelar el contacto al ver un aviso; no crear cientos de chats. El prestador solo abre canal privado al participar autorizadamente según reglas de consentimiento.
- Anti-spam: límites de solicitudes y propuestas por usuario/unidad de tiempo, deduplicación, denuncia, moderación, mínimo de identidad para participar, rate limits distribuidos en DB/edge (no `Map` en memoria).
- Evitar «postulación» engañosa si un perfil aún no fue autorizado como prestador; mostrar «Completá verificación» como CTA de onboarding.

## B3. Cotizaciones múltiples y selección

- El cliente ve ofertas de varios prestadores bajo UNA solicitud. Cada oferta contiene prestador, identidad/reputación legítima, alcance, precio, fecha, condiciones y vigencia. Orden configurable y explicable; no adjudicar ganador por precio solo.
- La comparación muestra 2–3 ofertas en móvil por tarjetas verticales, no tabla ancha; permitir «Ver detalle», «Hablar», «Contraofertar» y **«Contratar»** una vez aceptadas las condiciones.
- Cada oferta puede iniciar su conversación `client ↔ provider` propia; otros proveedores no pueden ver propuestas privadas ni los datos del cliente; precio de referencia del anuncio puede ser público solo cuando el cliente lo autorizó.
- La aceptación de UNA oferta realiza atómicamente: validar solicitud abierta, oferta vigente, proveedor autorizado, capacidad/agenda y última versión; insertar UN `Job`; marcar solicitud «cubierta/adjudicada»; cerrar/superseder otras ofertas para contratación de una sola plaza; avisar cordialmente a los no elegidos. **Si el usuario pidió varias plazas, modelarlas explícitamente como unidades separadas; nunca adjudicar dos por carrera de dos clics.**
- Cancelación/archivo/vencimiento de solicitud abierta NO cancela trabajos ya contratados. «Editar» cambios materiales invalida ofertas que dependían de los términos anteriores o pide reconfirmación.
- Permitir optar por _invitación a proveedores seleccionados_ como subflujo futuro de esta B; no ampliar alcance sin necesidad.

## B4. Estados propuestos (en un dominio independiente)

`DRAFT → OPEN → AWARDED | CLOSED_WITHOUT_HIRE | CANCELLED | EXPIRED | MODERATION_HOLD`.
Ofertas: `DRAFT → SUBMITTED → COUNTERED | ACCEPTED | REJECTED | WITHDRAWN | EXPIRED | SUPERSEDED`.

**No sustituir los `proposal_status` legacy sin plan:** mapear/adaptar las ofertas a `proposals` versionadas donde sea compatible; las necesidades abiertas nuevas requieren entidad `service_requests` y relación de múltiples ofertas, no fingir que son una sola conversación con varios proveedores ni crear un servicio falso publicado por el cliente.

# 4. CONTRATACIÓN — CONTRATO ÚNICO PARA A Y B

En ambos sistemas, ANTES de confirmar mostrar un **resumen congelado**:

- nombre y avatar de ambas partes;
- servicio/solicitud origen, versión aceptada, descripción/alcance, materiales, exclusiones;
- modalidad _del trabajo_ (`IN_PERSON` o `REMOTE`; `BOTH` en servicio obliga elegir una al contratar), zona y dirección exacta solo revelada al proveedor contratado según reglas de privacidad;
- precio final en ARS, unidad, cantidad y desglose; si precio no está cerrado **no se puede confirmar**;
- horario/franja/fecha límite o «A coordinar» con compromiso de acordarlo antes de iniciar; política de cancelación visible (nunca tarifa inventada);
- **«Esta contratación no realiza ningún cobro. El pago se acordará entre ustedes fuera de YALO y podrá declararse aquí»**.

**Una sola CTA:** «Confirmar contratación» o «Confirmar reserva» según caso. Aceptación atómica server-authoritative, idempotency key estable por solicitud/propuesta/actor, protección frente a doble click/reintento, compare-and-swap de versión y lock de capacidad/agenda. Confirmación visual, enlace inmediato a «Seguimiento».

**Se mantiene:** `CONFIRMED` como estado inicial de `Job`; \`payment_attempt_id\` nullable. Ningún trabajo nace por mensaje de chat o pulsar «Consultar». Dar nombre legible al evento y a los participantes.

# 5. TRABAJO ACTIVO — DOS VISTAS, UN ESTADO

| Estado negocio existente        | Cliente: «Qué sigue» y CTA                                           | Prestador: «Qué sigue» y CTA                  | Notificación/evento                          |
| ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `CONFIRMED` sin agenda concreta | «Acordar fecha» → coordinar                                          | «Proponer horario»                            | Confirmación + coordinación                  |
| `CONFIRMED` con fecha           | «Trabajo programado»; chat y detalles                                | «Iniciar trabajo» solo cuando corresponde     | Recordatorio pertinente; no asegurar llegada |
| `IN_PROGRESS`                   | «Trabajo en curso»; chat, ayuda, revisar cambios                     | «Registrar avance» / «Preparar entrega»       | Inicio y cambios relevantes                  |
| `COMPLETION_REQUESTED`          | «Revisar entrega» → Confirmar / Pedir corrección / Reportar problema | «Esperando revisión»; ver entrega             | Solicitud de revisión y plazo explícito      |
| `COMPLETED`                     | «Trabajo completado»; pago externo + reseñar                         | «Trabajo completado»; registrar cobro externo | Cierre; feedback/conciliación separados      |
| `DISPUTED`                      | «Caso en revisión», aportar evidencia                                | Igual, responder                              | Ticket y plazos/revisión                     |
| `CANCELLED` / `NO_SHOW`         | Motivo, quién lo registró, ayuda                                     | Igual                                         | Cancelación/ausencia, no emitir cobro        |
| `EXPIRED`                       | «Venció sin iniciar», si aplica                                      | Igual                                         | Vencimiento sin reclamaciones automáticas    |

**UI única para todos:** arriba estado legible, contraparte, fecha y monto; al centro **un CTA principal de rol**, bloque «Esperando a X» y próximo hito; abajo chat, resumen de acuerdo, archivos de entrega, cambios aprobados, agenda, ayuda e historial expandible. No insertar pasos financieros en el progreso de ejecución. El chat sirve para coordinar; el contrato no queda enterrado entre 200 mensajes.

**Presencial:** «En camino» se permite solo como actualización manual opcional veraz; no inventar GPS, ETA ni seguimiento de ubicación en vivo. **Remoto:** no presentar «cuando llegues», «dirección», «mostrá PIN»; ofrecer «Comenzar tarea» y carga de entregables.

**Reprogramaciones:** propuesta de fecha de una parte → otra acepta/rechaza → snapshot/agenda cambia al aceptar; prevenir solapamiento de agenda simultáneo. Si rechazo, conservar fecha anterior sin sobrescribirla.

**Cambios de alcance:** proponer ajuste con descripción, coste adicional o descuento, plazo modificado, justificación; aceptar expresamente antes de ejecutar/cobrar. Consentimiento y versión auditables. Si no hay acuerdo, mantener lo original o cancelar/resolver por las reglas, no forzar pago. Con pagos online OFF, un adicional aceptado se agrega al **monto acordado externo**, NO a una solicitud de «Pagar adicional con MP» ni a `AWAITING_PAYMENT` como bloqueo imposible.

# 6. ENTREGA Y FINALIZACIÓN — DECISIÓN D3

## 6A. Presencial (PIN para constancia de entrega)

1. Prestador pulsa **«Solicitar revisión»** cuando sostiene que terminó. Puede adjuntar pruebas opcionales no invasivas y resumen. No puede marcar `COMPLETED` unilateralmente.
2. Cliente recibe «El prestador dice que terminó. Revisá el resultado antes de compartir el PIN». Cliente consulta alcance/fotos/resultado.
3. Si lo recibido corresponde a la entrega física acordada, **el cliente comparte el PIN presencial de forma voluntaria**. El prestador lo introduce para dejar constancia de la entrega; 4 dígitos solo mientras exista protección real de intentos, caducidad/rotación apropiada y privacidad por roles.
4. **El PIN no equivale a conformidad definitiva ni a pago.** El cliente ve una acción clara, separada: «Confirmar trabajo terminado». Alternativas «Necesito una corrección» y «Reportar problema» siempre visibles durante ventana elegible.
5. Después de confirmar → `COMPLETED`. Si el PIN ya se validó, explicar por qué queda la revisión final; evitar que parezca doble validación redundante.

**Compatibilidad con el estado actual:** hoy `request_job_completion(uuid,text)` valida PIN antes de mover `IN_PROGRESS → COMPLETION_REQUESTED`. Para respetar «revisar antes de compartir», el SPEC exige desacoplar **solicitud de revisión** de **verificación presencial** y de **confirmación final**. Un esquema válido agrega campos/eventos `delivery_submitted_at` y `handover_verified_at` sin inventar nuevos `job_status` globales si no hacen falta. No convertir el PIN en aceptación final por atajo y no romper el rate-limit/autoridad única ya implementados en producción.

**Si no hubo interacción física al final** (servicio en domicilio sin cliente presente): ofrecer confirmación digital del cliente con evidencia y, si es imprescindible, mediación, **no obligar a revelar PIN por chat o forzar una entrega ficticia**. Si el cliente no comparte PIN por disconformidad, la UI debe permitir corrección/disputa; no revelar el PIN al proveedor mediante RLS o RPC.

## 6B. Remoto (entrega digital, sin PIN)

1. Prestador pulsa «Entregar trabajo»: resumen, archivos/enlaces necesarios o evidencia verificable según categoría; marcar `delivery_submitted_at`, versión y deadline de revisión. **No pedir PIN**.
2. Cliente recibe notificación con acceso directo a entregables; «Revisar», «Pedir corrección» (con motivo) o «Confirmar trabajo terminado».
3. La corrección reabre la revisión/recibe nueva versión con historial; limitar loops abusivos mediante incidente/soporte, **sin borrar versiones previas**.
4. Solo confirmación digital explícita o autocierre bajo política indicada lleva a `COMPLETED`. Los archivos no deberían perderse al terminar un contrato ni quedar públicos.

## 6C. Plazo, silencio y autocierre

**Default propuesto, pendiente de validación operacional sin bloquear maquetación:** esperar hasta **7 días** de `COMPLETION_REQUESTED`, recordatorios útiles y espaciados (ej. 24 h y 72 h), luego cierre automático SOLO si existe evidencia válida de entrega y ausencia de disputa/corrección abierta; dar **7 días** adicionales para apelar un autocierre si así lo permiten las reglas vigentes.

- El cron SQL actual ya tiene lógica de 7 días/autocierre + apelación en algunas situaciones; se debe comprobar que se adapta a modalidad y pruebas de entrega, **no reutilizar cron ciegamente**.
- Si no hay prueba de entrega, no cerrar por el mero paso del tiempo: notificar ambas partes y abrir vía de soporte.
- Conflictos: disputa/cancelación/solicitud de corrección bloquean autocierre; condiciones revalidadas bajo lock para que cron no pise cambios concurrentes.
- La falta de respuesta NO confirma ni prueba el pago externo.

# 7. DINERO FUERA DE YALO — DECISIÓN D4 (EL CAMBIO CON MAYOR IMPACTO)

## 7.1 Contrato de verdad financiera

**Frases obligatorias:** «Acordado», «Declarado por cliente», «Declarado por prestador», «Pendiente de confirmación», «Confirmado por ambas partes», «En desacuerdo». Jamás «Pago verificado por YALO» sin una fuente técnica autorizada (que HOY NO existe).

Mientras los flags de pagos online estén OFF:

- No pedir conectar Mercado Pago, no crear checkout, no invocar webhook como consecuencia de una declaración, no producir receipts o documentos que aparenten comprobante bancario emitido por YALO.
- Mostrar «Pueden acordar efectivo o transferencia directamente. YALO no recibe ni custodia el dinero; registrá lo pagado para llevar el control». No publicar datos bancarios ni teléfonos en el marketplace abierto; jamás solicitar CVV, contraseñas, token bancario, OTP bancario o datos de tarjeta.
- Contratar **sin adelanto exigido**; si acuerdan un anticipo externo en una fase posterior, requiere cláusulas, consentimiento claro y control separado. **En v1.0 no incorporar anticipos obligatorios.**
- Una comisión de YALO que figure en catálogos puede ser orientación comercial, pero no afirmar que ha sido cobrada/descontada; definir modelo de comisión externa y documentación legal antes de usar cifras/compensaciones automáticas.

## 7.2 Declaración y conciliación bilateral (nuevos objetos; no usar «FAKE»)

**Primera versión recomendada:**

1. En trabajo `COMPLETED` aparece tarjeta «Pago entre ustedes», con **importe del acuerdo + extras aprobados**, acumulado confirmado, saldo y método informado. Si hay pagos externos parciales permitidos, indicar monto y saldo; v1 permite múltiples abonos de forma opcional si se implementa bien el ledger.
2. Cliente pulsa **«Informar que pagué»**: importe (por defecto saldo), método `EFECTIVO` / `TRANSFERENCIA` / `OTRO ACORDADO`, fecha aproximada, referencia opcional y comprobante **privado** opcional. Confirmación: «Esta declaración se enviará al prestador; todavía no significa que esté confirmado».
3. Prestador ve **«El cliente informó un pago de $X»** → **«Confirmar que lo recibí»** / **«No lo recibí»** (motivo opcional, enlace a soporte). Solo confirmación positiva del receptor cambia ese abono a **CONFIRMED_BY_BOTH**.
4. Prestador también puede iniciar «Registrar dinero recibido», pero requiere confirmación del cliente para reconciliar, y jamás se auto-confirma por ser el destinatario.
5. Ambos ven el historial completo de declaraciones, respuestas y ediciones; nunca sobrescribir eventos auditables. Correcciones se hacen con `void/supersede` y nuevo registro, sin borrado silencioso.
6. Si conflicto: `CONTESTED` y soporte, congelar cierre financiero sin revertir automáticamente el trabajo `COMPLETED`. Separar un ticket de disputa de pago externo de una disputa de calidad. YALO puede mediar en información de su plataforma, **no garantizar reintegro** de transferencia/efectivo externa.

**Estados por cada pago externo:** `DECLARED_BY_CLIENT | DECLARED_BY_PROVIDER → AWAITING_COUNTERPARTY → CONFIRMED_BY_BOTH | CONTESTED | VOIDED`. **Ledger:** `agreed_total_minor`, `external_confirmed_minor`, `external_claimed_minor`, `external_outstanding_minor = max(agreed - confirmed,0)`. No permitir confirmed_amount > agreed sin versión aprobada; no sumar dos veces declaraciones recíprocas; compensaciones/reembolsos externos se anotan explícitamente y no se equiparan a refund procesado.

**Estados visuales del trabajo vs dinero:** trabajo puede estar `COMPLETED` y pago `UNREPORTED/PARTIAL/DECLARED/CONFIRMED/CONTESTED`. Solo el último puede mostrarse «Pago externo confirmado por ambas partes». No convertir `job_settlement_attempts` con provider `FAKE` ni `settlement_status=SETTLED` en evidencia bancaria de una transferencia.

## 7.3 Reglas de seguridad/privacidad

- RPC/RLS per-job: SOLO cliente, proveedor del trabajo y admin autorizado pueden ver declaraciones/comprobantes; service_role internamente sin filtración pública; evidencia privada con URL temporal firmada, no logs con PII ni URL expuesta.
- Validación de tipo/tamaño de adjuntos y contenido; minimización de referencias bancarias; retención/eliminación conforme políticas; no mostrar CLABE/CBU/alias/datos sensibles públicamente.
- Idempotencia por declaración, límites antifraude/anti-spam; comprobantes aportados por usuarios se marcan «No verificados por YALO».
- No activar conciliación automática de pagos reales al migrar a MP: trabajos con saldo externo ya confirmado deben quedar **excluidos** de checkout futuro para no cobrar dos veces; casos de declaraciones disputadas requieren revisión específica.
- Diferenciar actividad externa real y simulación admin en analytics, UI y reportes, con labels explícitos.

## 7.4 Copy de pagos que corregir YA

**Evidencia concreta en main:** `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx` hoy dice «Pagás al finalizar desde YALO» y «Comisión de YALO incluida en el total»; no es correcto con D4 + pagos OFF. **Otro bloqueo P0 de copy:** `apps/web/src/lib/ui/guided.ts` mantiene `getProviderNextAction()` → «Conectá tu cobro», «Sin esto no podés cobrar», «Conectar Mercado Pago» cuando `paymentConnected=false`, incluso con `PAYMENTS_ENABLED=false`; `getClientNextAction()` → «Tenés un pago pendiente» y «Ir a pagar» ante `pendingPayment=true`, aunque no hay checkout. Sus callers actuales en `apps/web/src/app/(provider)/provider/manage/page.tsx` y `apps/web/src/app/(account)/jobs/page.tsx` no pasan el flag. También `CLIENT_HIRE_STEPS` termina con «Pagá» sin aclarar que el pago es externo. Corregir utilidades, callers, tests y el panel de Mercado Pago para que la guía principal promueva el cobro externo declarado, nunca la vinculación obligatoria, y para que se pueda trabajar sin cuenta MP. Cambiarlo por «Acordás el precio al contratar. El pago se realiza directamente entre las partes; YALO permite registrar lo declarado» y aclaración contractual real de comisión, sin prometer cobro dentro de app.

- `apps/web/src/components/jobs/job-tracking.ts` ya comunica «pago online pendiente de habilitación» pero debe ahora dirigir al registro **externo declarado** después de cerrar, en vez de solo una deuda inoperable.
- Historial `/jobs`: «Pendiente de pago» pasa a «Pago externo sin confirmar» donde corresponda, no reclamar mora; no es válido inferir deuda si ya informaron pagos externos aún sin reconciliar.

# 8. DISPUTAS, CANCELACIÓN Y AUSENCIAS (NO PUEDE HABER CALLES SIN SALIDA)

| Caso                                    | Acción permitida                                                                                | Efecto                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Consulta/oferta sin respuesta           | Ver pendiente, retirar, editar, reenviar con límite, caducidad explicada                        | Sin trabajo creado                                                 |
| Propuesta vencida                       | No aceptar; pedir nueva o contraofertar nuevos términos                                         | No resurrect vencida                                               |
| Reserva de horario ocupado              | Rechazo transaccional y alternativas                                                            | No doble booking                                                   |
| Cliente cancela antes de iniciar        | «Cancelar solicitud/trabajo» + motivo                                                           | `CANCELLED`; no inventar penalidad                                 |
| Prestador cancela                       | Explicar al cliente + alternativas/reiniciar búsqueda                                           | `CANCELLED`; reputación/disciplina solo según política futura      |
| No-show presencial                      | Registrar ausencia con fecha, contexto y evidencia opcional, avisar contraparte                 | `NO_SHOW` sólo tras ventana/política objetiva; disputable          |
| Cambio agenda                           | Solicitar/aceptar/rechazar; conservar fecha si rechazo                                          | Evento auditable                                                   |
| Trabajo incompleto/dañado               | «Solicitar corrección» o «Reportar problema» con evidencia                                      | Congelar autocierre; soporte                                       |
| Prestador dice entregado, cliente niega | Disputa de entrega/calidad, revisar evidencia y PIN si hubo                                     | NUNCA auto-confirmar calidad ni pago                               |
| Pago externo declarado, receptor niega  | «No lo recibí» → `CONTESTED`                                                                    | Registro financiero en disputa; no prometer recuperación de fondos |
| Cuenta bloqueada/suspendida             | Preservar acceso limitado a documentación de trabajos previos y canal de soporte según permisos | No permitir nuevas contrataciones                                  |
| Fraude/acoso                            | Bloquear/reportar, ocultar datos y activar moderación                                           | Respeta seguridad sin borrar evidencia                             |

**Reglas pendientes de política comercial y NO inventadas en esta SPEC:** penalizaciones, anticipo, depósito, reembolsos, plazos legales de pago, garantías y sanciones. En v1 **no aplicarlos automáticamente**. Administración debe disponer de trazabilidad y decisiones auditables; una disputa no se cierra en silencio tras marcar estado.

# 9. PANTALLAS OBLIGATORIAS Y MAPA DE NAVEGACIÓN

**Sitio público**

- `/` — dos CTAs bien diferenciados «Buscar servicios» y «Publicar lo que necesitás»; marca YALO; búsqueda prominentemente.
- `/buscar` — cards de servicios, filtros modalidad/zona/precio, búsqueda clara; entrada secundaria a solicitudes públicas para prestadores autorizados.
- `/p/[slug]`, `/p/[slug]/[serviceSlug]` — confianza, condiciones y CTA correcta según modalidad económica/instant booking.

**Cuenta cliente**

- NUEVA `/solicitudes/nueva` — wizard de publicación con borrador recuperable.
- NUEVA `/solicitudes` — «Borradores», «Publicadas», «Esperando propuestas», «Elegí prestador», «Cerradas».
- NUEVA `/solicitudes/[id]` — resumen, visibilidad/editar, comparador de propuestas, señales de seguridad, candidatos e historial.
- `/messages` + `/messages/[conversationId]` — cotización y comunicación 1:1, propuesta resumida anclada.
- `/jobs` — pestaña «Activos» correctamente rotulada y «Historial», «Por revisar», no «Todos» si excluye terminados.
- `/jobs/[jobId]` — «Qué sigue», contrato, entrega, confirmación, ayudas, pago externo, reseña.

**Cuenta prestadora**

- `/provider/onboarding` y etapas — CTA real de alta, requisitos verificados; **el paso 4 «Revisar y enviar» debe ENVIAR desde esa pantalla**, no devolver a Documentos como CTA principal.
- `/provider/manage` — catálogo, disponibilidad preautorizada para instant booking, agenda y solicitudes.
- NUEVA `/oportunidades` — tablero de solicitudes compatibles y CTA proponer/declinar.
- NUEVA `/oportunidades/[id]` — detalles permitidos, privacidad y envío de oferta.
- `/messages` — consultas/contraofertas.
- `/jobs` y detalle — misma máquina de estados, copy CTA prestador y registro de cobro externo.

**Ambos roles, misma cuenta:** navegación contextual «Contratar / Ofrecer» o entradas claras, NO dos cuentas ni conversión destructiva. Notificaciones/badges deben indicar acciones pendientes sin confundir roles. En mobile bottom-nav seleccionar un destino estable y mostrar las otras entradas en un menú visible, sin 8 tabs apiladas.

### Pantalla canónica de trabajo — composición

1. App bar: volver + servicio + menú ayuda.
2. Encabezado: contraparte, foto, badge estado, coste acordado.
3. Hero «Qué sigue» + CTA de rol (o mensaje «Esperando a…»).
4. Sección «Entrega/Correcciones» visible SOLO cuando aplica; PIN no expuesto al prestador.
5. Sección «Acuerdo» con versión aceptada y cambios; horarios.
6. Sección «Pago entre ustedes» independiente de progreso del trabajo; CTA declarar/confirmar/disputar.
7. Chat y ayuda siempre accesibles; historial en acordeón, sin logs técnicos.
8. Reseña solo para `COMPLETED` y reglas antimanipulación existentes.

# 10. MATRIZ DE AUTORIZACIONES POR ACTOR

| Acción                                  |                  Cliente dueño |                                   Prestador asignado | Otro prestador compatible |                                        Anónimo |                             Admin |
| --------------------------------------- | -----------------------------: | ---------------------------------------------------: | ------------------------: | ---------------------------------------------: | --------------------------------: |
| Explorar perfiles/servicios públicos    |                             Sí |                                                   Sí |                        Sí |                                             Sí |                                Sí |
| Crear solicitud abierta                 |                             Sí |                             Sí si actúa como cliente |  Sí si actúa como cliente |                         No (borrador local sí) |                         Según rol |
| Leer detalles públicos de solicitud     |                             Sí |                             Si autorizada/compatible |  Si autorizada/compatible | Solo si política pública permite datos mínimos |                  Según moderación |
| Ver dirección exacta/adjuntos privados  |      Solo su solicitud/trabajo |       Solo si contratado o consentimiento específico |                    **No** |                                             No |           Justificación, registro |
| Ofertar en solicitud abierta            |  No como prestador de sí mismo |                 Sí si ACTIVE, elegible, no bloqueado |            Sí si elegible |                                             No |               No fingir proveedor |
| Ver todas las ofertas de una solicitud  |                             Sí |                                       Solo su oferta |            Solo su oferta |                                             No |                 Sí por moderación |
| Aceptar oferta/crear contrato           |                             Sí | No salvo reserva previamente preautorizada según RPC |                        No |                                             No |             No simular aceptación |
| Iniciar y solicitar revisión de trabajo |                             No |                                                   Sí |                        No |                                             No |          Acción especial auditada |
| Compartir/visualizar PIN presencial     |                             Sí |              **Nunca leer PIN**; solo enviar intento |                        No |                                             No |       Acceso excepcional auditado |
| Confirmar calidad del trabajo           |                             Sí |                                                   No |                        No |                                             No |            Resolución excepcional |
| Declarar pago emitido/recibido          |                             Sí |                                                   Sí |                        No |                                             No | Registro administrativo explícito |
| Confirmar recepción de dinero           |                   No (si paga) |                                        Sí (receptor) |                        No |                                             No |            No simular conformidad |
| Impugnar declaración de pago            |                             Sí |                                                   Sí |                        No |                                             No |            Intervenir vía proceso |
| Ver evidencia/denuncias                 | Participantes según privacidad |                       Participantes según privacidad |                        No |                                             No |         Mínimo necesario/auditado |

**Autoridad siempre server-side:** IDOR, RLS, SECURITY DEFINER, actor/estado/versión, carrera de dos sesiones, rate limit, bloqueo. El frontend solo acompaña y nunca sustituye permisos de DB.

# 11. MATRIZ DE TRANSICIONES Y CONSISTENCIA

## 11.1 Estado de consulta (nuevo)

`OPEN → AWARDED` exclusivamente al confirmar un contrato válido. `OPEN → CANCELLED/EXPIRED/CLOSED_WITHOUT_HIRE` bajo actor/política. No revivir oferta vencida sin nueva versión. `AWARDED` jamás admite segunda plaza si `capacity=1`.

## 11.2 Propuesta

`OPEN → ACCEPTED / REJECTED / WITHDRAWN / EXPIRED`; revisiones/contraofertas generan versión nueva y vuelven a exigir aceptación del destinatario. Solo `ACCEPTED` con precio/alcance snapshot completo permite crear trabajo. Mantener legado `DIRECT_BOOKING` únicamente con preautorización real.

## 11.3 Trabajo

`CONFIRMED → IN_PROGRESS → COMPLETION_REQUESTED → COMPLETED`.
En presencial, verificar constancia PIN como **evento/atributo independiente** antes de la confirmación del cliente, con alternativa digital/mediación justificada; remoto no solicita PIN.
Excepciones desde estados elegibles: `CANCELLED`, `DISPUTED`, `NO_SHOW`, `EXPIRED`. Autocierre exige evidencia y carrera segura. No permitir combinaciones imposibles (ej. `COMPLETED` sin entrega/autocierre o doble `Job` por una oferta).
`COMPLETED` puede cambiar a `DISPUTED` durante apelación válida de autocierre; preservar historial y derechos.

## 11.4 Pago externo

Separado del job: `NOT_REPORTED → DECLARED → CONFIRMED_BY_BOTH`; `DECLARED → CONTESTED/VOIDED`; múltiples abonos llevan a `PARTIAL_CONFIRMED` o `FULL_CONFIRMED`. NUNCA poner `SETTLED` de Mercado Pago sobre la base de un screenshot o declaración. Admin no debe manipular balances con provider FAKE para representar efectivo real.

## 11.5 Invariantes de datos indispensables

- Una sola aceptación ganadora por solicitud de una plaza; un solo trabajo por propuesta aceptada.
- Una sola capacidad/reserva por slot; bloqueo y validación bajo transacción.
- Snapshot de precio/alcance/fecha/modo inmutable por versión aceptada; modificaciones versionadas.
- No cobrar por automatismos con `PAYMENTS_ENABLED=false`; no publicar información privada de solicitudes.
- Código de entrega no expuesto a quien lo valida; límite de intentos aplicado en el RPC de autoridad (ya resuelto en PR #22; conservar/regresar tests).
- Declaraciones externas no sustituyen estados de pago online ni activan checkout futuro.
- Eventos durables y deduplicados por `idempotency_key`, con actor, timestamp, versión y motivo cuando corresponda.

# 12. NOTIFICACIONES, SEÑALES Y TIMEOUTS

| Evento                             | Destinatario                      | Acción de notificación                                 |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------ |
| Nueva consulta dirigida            | Prestador                         | «Respondé consulta» → conversación/resumen             |
| Nueva solicitud abierta compatible | Prestadores que opten por alertas | Digest pertinente, no push masivo ni dirección privada |
| Nueva oferta o contraoferta        | Cliente / contraparte             | «Revisar condiciones»                                  |
| Contratación confirmada            | Ambas partes                      | «Ver trabajo»                                          |
| Propuesta de reprogramación        | Contraparte                       | «Aceptar o rechazar fecha»                             |
| Cambio de alcance                  | Contraparte                       | «Revisar precio y alcance»                             |
| Trabajo iniciado                   | Cliente                           | «Ver seguimiento»                                      |
| Entrega/revisión solicitada        | Cliente                           | «Revisar trabajo» (y evidencia)                        |
| Corrección/disputa                 | Contraparte y admin si aplica     | «Responder/ver caso»                                   |
| Autocierre posible                 | Cliente                           | Recordatorios previos y ventana de apelación clara     |
| Pago externo declarado             | Contraparte                       | «Confirmar recepción / confirmar que pagué»            |
| Pago externo discutido             | Ambas partes y soporte            | «Ver desacuerdo»                                       |
| Nueva reseña/respuesta             | Prestador / cliente               | «Ver reseña»                                           |

- Notificación push/correo tiene URL canónica, deduplicación, permiso/opt-in y preferencias existentes. No avisar «deuda exigible» ni «cobro garantizado» con pagos offline.
- Plazos por defecto: propuestas abiertas **7 días** si emisor no eligió vencimiento; avisar antes; solicitudes abiertas **14 días** y archivar con reabrir sujeto a reglas; revisión final **7 días** y apelación de autocierre **7 días**. **Son defaults propuestos por SPEC, no condiciones legales ni SLA**: configuración administrable por tipo de servicio/ciudad y pruebas; no aplicar penalidades automáticas por vencer.
- Programación: usar zona del trabajo (ej. America/Argentina/Buenos_Aires), guardar UTC, mostrar TZ en UI si cliente/prestador están en regiones distintas.
- Avisos de ausencia antes de penalización solo después de una ventana operativa publicada; no copiar 5 minutos de PedidosYa a un plomero.

# 13. COMPONENTES UI/UX Y ACCESIBILIDAD PREMIUM

- **Un solo CTA primario por estado**; secundarias discretas, acción destructiva con confirmación, soporte contextual.
- Formularios: máximo 3 decisiones visibles por pantalla antes de expandir opcionales, títulos naturales, ejemplo de necesidad bien redactada, validación inline, no perder texto al error/refresh/atrás.
- Propuestas: tarjeta comparable y fechas válidas, vista histórica de versiones; doble pulsación no crea segundo contrato.
- Mensajería: conservar scroll al cargar páginas anteriores, no forzar al final si leyendo arriba, nuevos mensajes badge; adjuntos con progreso/reintento y error visible; teclado Android/safe-area.
- Diseño YALO: tokens navy/cyan/teal/mint, contrastes WCAG AA, claro/oscuro/sistema, no residuos naranjas ni degradados sin propósito; tipografía legible, 44–48 px táctiles.
- Presencial: ubicación aproximada antes de contrato, exacta solo tras contratar y con necesidad operacional; por defecto sin tracking GPS. Remoto: sin mapas ni PIN.
- Estados vacíos con acciones («Aún no recibiste ofertas; ajustá tu solicitud o compartila»); jamás resultados truncados por paginar después de filtrar.
- Evitar «Todos» cuando `/jobs` trae solo activos; renombrar o combinar activos+histórico correctamente.
- Paso final onboarding: botón «Enviar a revisión» vive realmente en paso 4 con resumen.
- PWA: actualizar capturas de instalación tras rebrand, inspeccionar wordmark YALO **provisional** y conseguir master aprobado; dark mode, splash, OG, icon maskable y caché segura.
- Rendimiento: medir Web Vitals/Lighthouse en móviles representativos y establecer baselines; no imponer puntuaciones sin medir. Probar 360/390/412, 768/1280, teclado, zoom 200 %, screen readers, baja conectividad y reconexión.

# 14. DISEÑO TÉCNICO — SUGERIDO, NO SQL PARA EJECUTAR

### Entidades nuevas (solo propuesta de modelo; verificar contra histórico remoto)

1. `service_requests` (client, title, description, category, modality, zone/coarse_geo, schedule, price_hint, state, visibility, expires, version, idempotency).
2. `service_request_attachments` en storage privado o público cuidadosamente clasificado; never exact address.
3. `request_proposals` puente solicitud↔proposal↔provider con aislamiento per-actor; ideal reutilizar `proposals/proposal_versions` en vez de duplicar reglas.
4. `request_awards` (request_id, winning_proposal, job_id, slot_id) con unique por plaza/capacidad; constraints transaccionales.
5. `job_deliveries` (job, revision, modality, submitted_by, timestamps, evidence, review status) y `job_handover_verifications` (PIN event sin revelar secreto).
6. `external_payment_declarations` y `external_payment_events` append-only con actor, amount_minor, method, private_receipt_ref, dispute status, reconciled amount; no confundir con `job_settlement_attempts` ni `provider_payment_accounts`.
7. Agregados autorizados para pendientes de cada rol; índices para listas y filtros; outbox de notificaciones existentes.

**Transición del sistema actual:** no reescribir todo; adaptar rutas legacy `/p/...`, `/messages`, `/jobs` y `Job`. Crear request abierta detrás de feature flag propia (`PUBLIC_REQUESTS_ENABLED`) hasta probar B. Mantener pagos online OFF. Migration SQL append-only sin `supabase db push` contra el remoto con 58 migraciones históricas ausentes del repo. Hacer comparaciones de firmas antes de reemplazar RPCs y comprobar grants/RLS.

**Decisión de arquitectura prioritaria:** no usar una conversación con N proveedores; el agregado `ServiceRequest` tiene N ofertas, y cada candidato tiene vista/interacción privada por separado.

# 15. MATRIZ QA END-TO-END Y SEGURIDAD

| ID  | Escenario                                                       | Resultado obligatorio                                                    |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| E01 | Visitante descubre un servicio, inicia login y vuelve           | Se conserva servicio, intención, borrador, sin duplicado                 |
| E02 | Precio fijo con reserva habilitada y slot libre                 | Una transacción crea 1 trabajo confirmado y 1 reserva                    |
| E03 | Precio fijo SIN reserva habilitada                              | Queda solicitud para prestador; NO crea job                              |
| E04 | «A cotizar» con fotos y fecha flexible                          | Solicitud y chat 1:1; cotización con precio y alcance                    |
| E05 | Contraoferta, expiración, rechazo, retirada                     | Versiones, motivos y UX correctos, sin job espurio                       |
| E06 | Doble tap / dos pestañas aceptan mismo presupuesto              | A lo sumo un job; feedback idempotente                                   |
| E07 | Cliente publica necesidad para varios                           | Recibe 3 ofertas privadas, comparables sin filtración entre proveedores  |
| E08 | Dos propuestas ganadoras simultáneas en solicitud 1 plaza       | Exactamente 1 award y 1 job; segunda recibe conflicto explicable         |
| E09 | Proveedor suspendido ofertando o viendo datos privados          | RPC/RLS rechaza y no deja huellas de privacidad                          |
| E10 | Reprogramación aceptada/rechazada                               | Slot no se solapa; original se conserva si rechazo                       |
| E11 | Adicional propuesto, aceptado/rechazado                         | Cambia acordado solo con consentimiento; NO crea checkout MP             |
| E12 | Presencial termina, cliente retiene PIN por falla               | Puede pedir corrección/disputa; no se completa unilateralmente           |
| E13 | 5 códigos erróneos y sexto válido dentro de 10 min              | Bloqueo real y persistente incluso por invocación RPC directa            |
| E14 | Remoto entrega PDF/video/link y pide revisión                   | Cliente revisa/aprueba/corrige sin PIN                                   |
| E15 | Cron autocierre simultáneo a disputa                            | Estado elegible con lock; no pisa disputa/corrección                     |
| E16 | Trabajo completado, sin pago externo                            | Reseña permitida, monto acordado visible, no «Pagado»                    |
| E17 | Cliente declara $X transferencia con comprobante                | Prestador ve «pendiente de confirmación»; no se acredita automáticamente |
| E18 | Prestador confirma recepción de $X                              | «Confirmado por ambas partes», audit log y saldo actualizado             |
| E19 | Prestador niega transferencia                                   | `CONTESTED`; no «pago verificado», soporte contextual                    |
| E20 | Dos pagos parciales y declaraciones simultáneas                 | No excede acordado ni duplica importes; reconcile correcto               |
| E21 | Work ya confirmado externamente, luego habilitan MP en staging  | No generar checkout doble; backfill/migración explícita                  |
| E22 | Cuenta A logout → cuenta B login en misma PWA                   | No fuga de trabajo, dirección, PIN, chats ni comprobantes en caché       |
| E23 | 55+ jobs y 30+ conversaciones                                   | Filtros server-side, cursors y unread agregados correctos                |
| E24 | Ausencia, cancelación, desacuerdo de calidad, usuario bloqueado | Caminos de ayuda/resolución sin callejón sin salida                      |
| E25 | Pantallas mobile 360/390/412 + dark/light/zoom                  | Sin scroll horizontal, CTA accesible y teclado usable                    |
| E26 | Permisos directos RPC (anon/otro proveedor/cliente)             | No puede adjudicar, cerrar, leer PIN o confirmar cobro ajeno             |
| E27 | Notificaciones de pago ONLINE OFF                               | Sin push «pagá desde YALO», solo declaraciones externas                  |
| E28 | Onboarding nuevo hasta revisión y ACTIVE                        | Paso 4 envía sin volver a Documentos; verificación efectiva              |

**Test fixture mínimo:** cuentas A cliente, B proveedor ACTIVE, C proveedor ACTIVE, D proveedor suspendido, E admin autorizado; 2 categorías (oficio presencial y tarea digital), 2 zonas, 2 servicios fijo/a cotizar, 1 solicitud pública con 3 ofertas; pagos externos simulados como declaraciones **etiquetadas TEST**, jamás fondos reales. Usar staging autorizado, no producir contrataciones ficticias en producción.

**Pruebas unitarias:** form validation, gating reservas, price math y minor units, estados y copy por rol; integration DB: locks, awards, RLS, idempotencia, PIN, read models, ledger, cron; e2e navegador: dos sesiones reales separadas + refresh/reconexión y screenshots.

# 16. MÉTRICAS DE PRODUCTO (INSTRUMENTAR, NO INVENTAR RESULTADOS)

Eventos mínimos sin PII: `service_viewed`, `direct_booking_review_opened`, `service_inquiry_sent`, `request_published`, `proposal_submitted`, `proposal_viewed`, `proposal_accepted`, `job_created`, `job_started`, `delivery_submitted`, `job_confirmed`, `external_payment_declared`, `external_payment_confirmed`, `review_submitted`, `dispute_opened`.

Embudo A: vista ficha → consulta/reserva → oferta → contrato → inicio → entrega → confirmación → reseña.
Embudo B: inicio publicación → publicada → primera oferta → comparaciones → adjudicación → contrato → ejecución.
Atribuir abandono por pantalla, errores de servidor, tiempo hasta primera respuesta, tasa de solicitud sin oferta, disputa y recontratación. **No incluir PIN, direcciones, DNI, comprobantes ni mensajes en analytics.** No fijar SLA hasta medir base.

# 17. PLAN DE IMPLEMENTACIÓN PARA MUSE (SLICES, CON STOP OBLIGATORIO)

**REGLA:** no ejecutar todos los lotes en una sola pasada. Muse debe informar resultado y **esperar auditoría/permiso** entre lotes; toda rama con base actualizada, PR revisable y tests.

**Fase S0 — corregir contradicciones actuales (sin nuevas tablas):**

- Ficha de servicio «Pagás desde YALO» y afirmaciones de comisión sin respaldo; copy de seguimiento/pagos externos, **incluidos `getProviderNextAction`, `getClientNextAction` y `CLIENT_HIRE_STEPS` en `apps/web/src/lib/ui/guided.ts`: hoy exigen MP y dan CTA «Ir a pagar» con pagos OFF**. Debe quedar testado que un prestador ACTIVE con servicio y sin MP puede trabajar y recibir dinero por fuera, y el cliente puede declarar pago externo, no pulsar un checkout imposible.
- Filtro «Todos», paso 4 onboarding, residuos de color YALO, screenshots PWA y revisión del lettering con master.
- Asegurar que no aparecen CTAs checkout/MP con flags OFF y ninguna notificación de pago imposible.
  **Gate:** copy 100% coherente D4 y capturas mobile, sin regresiones de contratación actual. No activar B todavía.

**Fase S1 — endurecer camino A:**

- Preautorización explícita de reserva directa con disponibilidad/capacidad bajo lock, transición de aceptación bilateral cuando falta.
- Solicitud estructurada, contexto persistente al chat, propuesta visible, seguimiento/pending real.
- Protección SQL del `DIRECT_BOOKING` legacy y pruebas de seguridad.
  **Gate:** E01–E06, matriz perfiles, idempotencia; mantener experiencia anterior si feature flag OFF.

**Fase S2 — solicitudes abiertas B:**

- Tablas/índices/RLS/read models `ServiceRequest`, wizard y tablero de oportunidades; ofertas aisladas, comparación y adjudicación atómica.
- Feature flag `PUBLIC_REQUESTS_ENABLED=false` hasta QA con tres oferentes; ON solo con autorización del propietario.
  **Gate:** E07–E09, E22–E23, carga/permisos/anti-spam. El flujo A no se altera.

**Fase S3 — entrega verificada multimodal:**

- Eventos de entrega/evidencias; PIN solo para presencial, sin bypass ni doble validación engañosa; entrega remota con archivos y revisión.
- Corrección/soporte, no respuesta, apelación y cron revisado; transición/bloqueo coherente.
  **Gate:** E10–E16, E24/E26; pruebas de concurrencia y documentación de cron.

**Fase S4 — declaraciones de pago externo:**

- Ledger independiente bilateral, adjuntos privados, declaraciones/confirmaciones/discrepancias, saldos y copy; soporte y reportes honestos.
- Preservar estado de pago MP desconectado y proteger contra cobro futuro doble.
  **Gate:** E17–E21 y E27; auditoría permisos y cálculo ARS, sin transacciones reales.

**Fase S5 — experiencia premium y endurecimiento:**

- QA completo accesibilidad/PWA/perf/analytics; pruebas de onboarding, notificaciones, cancelaciones, idioma y zona; terminar assets YALO.
- E2E de ambas rutas y ambas modalidades con cuentas autenticadas separadas; demo y evidencia en video/capturas.
  **Gate:** E01–E28 documentados PASS o excepción justificada. No declarar «premium» por build o commit.

**Validación sin GitHub Actions:** `pnpm --filter @changas/web typecheck`, `pnpm --filter @changas/web lint`, `pnpm test`, `pnpm --filter @changas/web build`, pgTAP contra DB de pruebas, inspección manual Android y revisión de logs. Sin cambios de producción automáticos. Leer `docs/CONTEXTO.md` por advertencia de 58 migraciones remotas que no están en repo.

## Entregables y formato del reporte Muse por fase

- Estado **PASS / FAIL / NO VERIFICADO** de cada criterio, no solo narración;
- files changed, arquitectura/DDL propuestos, razones, mitigaciones y rollback;
- migraciones en repo y estado **real** aplicado/no aplicado por ambiente;
- evidencia de 2 sesiones, capturas Android (móvil light/dark), logs de tests;
- qué se mantiene bajo flag y **qué no se activó**;
- riesgos no resueltos y permiso necesario para siguiente lote.

---

# 18. DECISIONES SECUNDARIAS ABIERTAS (NO CAMBIAN D1–D4)

1. **Categorías de lanzamiento/zonas:** el motor debe ser genérico; lanzar gradualmente para aprender, no imponer horarios urgentes genéricos.
2. **Urgencias y SLA:** mostrar «urgente» como preferencia hasta definir cobertura/tiempo prometido. Ningún timer estilo delivery sin operación para respaldarlo.
3. **Política de cancelación/no-show/revisiones:** sin multas automáticas en v1 hasta texto legal/política explícita; permitir contacto y soporte.
4. **Comisión de YALO sobre pagos externos:** no crear deuda ni cobrar fuera de una definición comercial/legal y consentimiento específico.
5. **Anticipos:** desactivados en v1 por defecto, no confundir con pago al cierre; cambio futuro requiere nuevo spec.
6. **PIN presencial sin cliente disponible:** usar alternativa de evidencia/confirmación digital/soporte autorizada y registrar excepción.
7. **Plazos sugeridos:** 7 días propuesta, 14 solicitud, 7 revisión, 7 apelación son _defaults para discutir_, no SLA ni garantía contractual; parametrizar si se decide.
8. **Identidad gráfica:** logos actuales trazados interinos en assets; obtener master vectorial fiel y validado para YALO, además de revisar uso legal del nombre.

**Nada de lo anterior autoriza a Muse a inventar comisiones, multas, garantías, reembolsos, algoritmos de ranking opacos o integraciones financieras.**

# 19. CRITERIO GLOBAL DE ACEPTACIÓN V1.0

YALO se considerará alineado con este SPEC cuando un cliente pueda **(a) reservar directamente con condiciones preautorizadas, (b) negociar con un prestador o (c) publicar una necesidad y elegir entre ofertas**, y el prestador pueda responder, contratar, coordinar, ejecutar, entregar y cerrar según modalidad; ambas partes puedan **declarar y confirmar** un pago externo sin ficción de verificación; ninguno quede atrapado ante rechazo, cancelación, no-show o disputa; y todo se pueda reproducir en móvil accesible sin fuga de datos, dobles contratos ni confusión de quién debe hacer qué.

**FUENTE DE VERDAD:** decisiones D1–D4 del usuario en la conversación del 14/10/2026. Los detalles que completan decisiones (plazos, estructuras nuevas, copies, agenda, tasas) se marcan como diseño propuesto y deberán revisarse contra la implementación vigente. Las referencias Uber/PedidosYa/Rappi sustentan **patrones de UX**, no una supuesta identidad de procesos entre ellas y YALO.
