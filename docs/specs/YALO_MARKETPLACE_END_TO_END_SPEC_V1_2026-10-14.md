# YALO ΓÇö SPEC FUNCIONAL V1.0
## Marketplace dual ┬╖ contrataci├│n ┬╖ ejecuci├│n ┬╖ entrega ┬╖ pagos externos declarados

**Fecha:** 14 de octubre de 2026 ┬╖ **Estado:** especificaci├│n de producto aprobada en sus 4 decisiones base; implementaci├│n por etapas sujeta a auditor├¡a/QA ┬╖ **Destinatario:** Muse Code.
**Repositorio:** gabsvm/changas ┬╖ **Base auditada:** main en `14b413a1e2e50a33e246c186645322b4deff27f2`, PR #22 fusionado, producci├│n Vercel READY.
**Documentos de base:** `docs/audits/2026-10-14-YALO-MUSE-HANDOFF.md`; `docs/brand/yalo/YALO_BRAND_SYSTEM.md`; investigaci├│n comparativa del 14/10/2026 entregada como `YALO_RESEARCH_RAPPI_PEDIDOSYA_UBER_SPEC_V0_2026-10-14.md`. El viejo master plan de Changas es referencia hist├│rica; ESTE SPEC define el comportamiento de YALO para estos flujos y no autoriza cambios silenciosos a otros dominios.
**No merge ni despliegue autom├ítico:** este documento es el contrato para implementar y probar mediante PRs peque├▒os. No modificar SQL productivo sin migraci├│n append-only, plan de aplicaci├│n, pruebas y aprobaci├│n. Mantener pagos en l├¡nea deshabilitados; no depender de GitHub Actions.

---

# 0. DECISIONES DEFINITIVAS DE PRODUCTO (D1ΓÇôD4)

| ID | Decisi├│n del propietario | Consecuencia obligatoria |
|---|---|---|
| D1 | **C. Dos sistemas de contrataci├│n** | (A) cliente elige un servicio/prestador y (B) cliente publica una necesidad y recibe ofertas de varios prestadores. Ambos convergen en UN contrato/trabajo. |
| D2 | **B. Reserva directa cuando se puede; negociaci├│n cuando no** | Un servicio fijo y previamente habilitado puede contratarse al instante; el resto exige propuesta/confirmaci├│n. Nunca simular disponibilidad ni aprobaci├│n del prestador. |
| D3 | **B. PIN presencial; entrega/verificaci├│n digital remota** | El PIN prueba la entrega/interacci├│n presencial, NO significa autom├íticamente satisfacci├│n ni pago; en remoto se usan evidencias digitales y aprobaci├│n del cliente. |
| D4 | **C. Pagos externos y declaraci├│n de pago** | Efectivo/transferencia/acuerdo directo fuera de YALO; ambas partes pueden informar y conciliar lo abonado, pero YALO no recibe, procesa, garantiza ni verifica fondos bancarios. |

**Restricciones vigentes:** una misma cuenta puede ser cliente y prestador; contratar NO obliga a pagar por adelantado; YALO no cobra online a├║n (`PAYMENTS_ENABLED=false` en aplicaci├│n, `payments_online=false` en Supabase); las simulaciones admin no constituyen cobro; no se exige GitHub Actions; nombre p├║blico YALO, no Changas.

**Precisiones que completa este SPEC:** en reserva directa el prestador puede otorgar autorizaci├│n anticipada espec├¡fica para servicio+agenda+capacidad+precio y as├¡ prescindir de segunda aceptaci├│n manual; si falta esa autorizaci├│n, el CTA es ┬½Solicitar contrataci├│n┬╗ y queda en espera de aceptaci├│n, no ┬½Reservado┬╗. Toda contrataci├│n guarda una versi├│n inmutable de las condiciones.

# 1. OBJETIVO DE EXPERIENCIA

**Promesa operacional:** ┬½S├⌐ qu├⌐ ped├¡, qui├⌐n responde, qu├⌐ acordamos, qu├⌐ sigue, si termin├│ y si el pago externo est├í confirmado por las partes┬╗.

Cinco preguntas siempre respondidas en la vista principal de cada solicitud/trabajo:
1. **Qu├⌐**: servicio, descripci├│n, alcance y extras aprobados.
2. **Con qui├⌐n**: contraparte verificable y modalidad.
3. **Cu├ínto**: precio acordado y saldo externo, distinguiendo declarado/confirmado.
4. **Cu├índo**: fecha/hora/zona o ┬½A coordinar┬╗; no ETA inventado.
5. **Qu├⌐ sigue**: responsable, acci├│n primaria, l├¡mites de tiempo y ayuda.

**Las cinco entidades NO son lo mismo:**
- `Service` = oferta publicada por un prestador;
- `ServiceRequest` = necesidad del cliente, dirigida o abierta;
- `Proposal/ProposalVersion` = t├⌐rminos econ├│micos y de alcance propuestos;
- `Job` = acuerdo contratado con snapshot aceptado;
- `ExternalPaymentRecord` = declaraci├│n/confirmaci├│n sobre movimiento ajeno a YALO.

**Una consulta no es contratar. Enviar presupuesto no es contratar. Aceptar una propuesta contrata. PIN no es evaluaci├│n de calidad. Completar no implica recibir dinero. ┬½Ya pagu├⌐┬╗ no implica ┬½pago confirmado┬╗.**

### Principios de referencia comparativa

Seg├║n documentaci├│n p├║blica ya recopilada:
- **PedidosYa:** revisar pedido/total antes de confirmar, aceptaci├│n visible, progreso y PIN despu├⌐s de entrega completa.
- **Uber:** acci├│n dominante y contextual por estado/actor; conductor informado, identificaci├│n, trayectoria y valoraci├│n; PIN de Uber es de INICIO del viaje y NO se copia como PIN de cierre de trabajo.
- **Rappi:** modificaciones/alternativas proactivas pero con aprobaci├│n de quien contrata; hitos y resoluci├│n de imprevistos.
Fuentes oficiales consultadas en la investigaci├│n: [Uber Argentina](https://www.uber.com/ar/es/about/how-does-uber-work/), [Uber conductor](https://www.uber.com/ar/es/drive/basics/how-to-take-trips/), [Uber PIN](https://help.uber.com/es/riders/article/what-is-verify-your-trip?nodeId=9a2a4bc6-002b-4461-8e9e-8ea29974795d), [PedidosYa t├⌐rminos](https://www.pedidosya.com.ar/about/terminos-condiciones), [Rappi Argentina](https://legal.rappi.com/argentina/terminos-y-condiciones-rappi-2/) y [Soy Rappi](https://legal.rappi.com/argentina/terminos-y-condiciones-rappitenderos-3/). No afirmar paridad de interfaz en tiempo real ni universalidad por pa├¡s.

# 2. SISTEMA A ΓÇö CLIENTE ELIGE PRESTADOR (ACTUAL + MEJORAS)

## A1. Descubrimiento
Pantallas: Inicio `/` ΓåÆ `/buscar` / categor├¡a ΓåÆ perfil `/p/[slug]` ΓåÆ ficha `/p/[slug]/[serviceSlug]`.
- Puede explorar sin login, comparar servicios, categor├¡as, precio y confianza; al iniciar acci├│n autenticada se conserva deep-link/intenci├│n durante login.
- Mostrar: t├¡tulo, especialidad, modalidad, zona p├║blica aproximada (no direcci├│n), precio bien rotulado (fijo / por hora / desde / a cotizar), condiciones incluidas/excluidas, duraci├│n si estimada, reputaci├│n proveniente de trabajos verificados.
- ┬½Identidad verificada┬╗ no equivale a ┬½matr├¡cula profesional┬╗ o garant├¡a de calidad; no fabricar rese├▒as, disponibilidad, tiempos de respuesta ni casos reales.

## A2. Decisi├│n seg├║n tipo de servicio (regla, NO inferencia de texto)
| Condici├│n real validada en DB | CTA cliente | Resultado |
|---|---|---|
| Precio FIJO + `instant_booking_enabled` + disponibilidad preautorizada y capacidad reservable + sin campos/visita que requieren negociaci├│n | **┬½Reservar por $X┬╗** ΓåÆ revisar condiciones ΓåÆ confirmar | Crear `Job CONFIRMED` inmediatamente, at├│mico e idempotente. |
| Precio FIJO sin disponibilidad preautorizada o requiere elegir hora/alcance | **┬½Solicitar contrataci├│n┬╗** | Solicitud pendiente ΓåÆ prestador acepta o propone cambio ΓåÆ confirmaci├│n bilateral. |
| Precio hora/unidad/desde/con visita o precio desconocido | **┬½Pedir presupuesto┬╗** | Consulta estructurada; conversaci├│n y propuesta. |
| Prestador no est├í aprobado / servicio suspendido / bloqueado / fuera de cobertura | CTA deshabilitado con explicaci├│n contextual o alternativa de b├║squeda | NUNCA crear trabajo. |

El `DIRECT_BOOKING` existente actualmente crea `ACCEPTED + CONFIRMED` en el SQL de `20261010000000_hire_on_accept.sql` con solo `price_model=FIXED`. **P0 DE CONGRUENCIA:** endurecer este camino para exigir autorizaci├│n anticipada y reservar capacidad; si falta, usar solicitud NO autoaceptada. Ning├║n usuario puede autoaprobar una contrataci├│n ajena mediante RPC directo.

## A3. Formulario previo (m├íximo 1 pantalla + confirmaci├│n)
Pedir solo informaci├│n que var├¡a el trabajo: problema/tarea concreta, modalidad, zona aproximada, disponibilidad preferida, fotos opcionales, notas de acceso privadas solo tras aceptar si presencial. Prellenar categor├¡a y servicio. No exigir fotos ni precio que el cliente no conoce.
- Tras ┬½Enviar solicitud┬╗: pantalla tarjeta **┬½Solicitud enviada┬╗**, fecha, resumen, identidad de quien debe contestar, bot├│n **┬½Ver conversaci├│n┬╗**; no enviar a chat vac├¡o sin contexto.
- Si cotiza el prestador: tarjeta de propuesta versionada, total, qu├⌐ incluye, qu├⌐ excluye, fecha/vencimiento. Acciones: **┬½Aceptar y contratar┬╗**, ┬½Contraofertar┬╗, ┬½Rechazar┬╗. Registrar raz├│n opcional, errores recuperables.
- Si contrato inmediato: mostrar **┬½Trabajo confirmado┬╗**, el resumen aceptado, contacto y siguiente paso.

# 3. SISTEMA B ΓÇö EL CLIENTE PUBLICA NECESIDAD (NUEVA FUNCI├ôN; NO EXISTE EN MAIN)

## B1. Entrada y creaci├│n
Nuevo CTA ┬½Publicar lo que necesit├ís┬╗ desde inicio/b├║squeda y una secci├│n ┬½Mis solicitudes┬╗.
**Wizard m├│vil corto de 3 pasos con borrador autosalvado:**
1. **Qu├⌐ necesit├ís:** categor├¡a/habilidad, t├¡tulo claro, descripci├│n, fotos/adjuntos opcionales, remoto/presencial, urgencia solo como dato de necesidad (sin promesa SLA).
2. **D├│nde y cu├índo:** zona aproximada o remoto, fechas preferidas o flexible, tipo de cita/plazo. Nunca publicar direcci├│n exacta, tel├⌐fono, DNI, correo ni fotos con datos privados sin advertencia.
3. **Revisar y publicar:** alcance y privacidad, presupuesto opcional como *orientativo* (nunca precio final), vigencia del anuncio, bot├│n ┬½Publicar solicitud┬╗.

**Entrada no autenticada:** guardar borrador local de forma no sensible o en sesi├│n ef├¡mera y recuperarlo tras login; limitar persistencia de im├ígenes privadas. Validar categor├¡a activa y cobertura geogr├ífica; confirmar publicaci├│n con enlace a la solicitud.

## B2. Difusi├│n a proveedores
- Mostrar la solicitud a proveedores `ACTIVE`, con habilidades correspondientes, modalidad/zona admisible, y que no est├⌐n bloqueados/suspendidos; una solicitud PUBLIC no implica datos personales p├║blicos.
- Inbox de oportunidades para proveedor: ┬½Para vos┬╗, filtros habilidad/zona/modalidad/plazo, portada/alcance, fecha, rango presupuestario indicado y CTA **┬½Enviar propuesta┬╗** o ┬½No me interesa┬╗.
- NO auto-enviar DM ni revelar el contacto al ver un aviso; no crear cientos de chats. El prestador solo abre canal privado al participar autorizadamente seg├║n reglas de consentimiento.
- Anti-spam: l├¡mites de solicitudes y propuestas por usuario/unidad de tiempo, deduplicaci├│n, denuncia, moderaci├│n, m├¡nimo de identidad para participar, rate limits distribuidos en DB/edge (no `Map` en memoria).
- Evitar ┬½postulaci├│n┬╗ enga├▒osa si un perfil a├║n no fue autorizado como prestador; mostrar ┬½Complet├í verificaci├│n┬╗ como CTA de onboarding.

## B3. Cotizaciones m├║ltiples y selecci├│n
- El cliente ve ofertas de varios prestadores bajo UNA solicitud. Cada oferta contiene prestador, identidad/reputaci├│n leg├¡tima, alcance, precio, fecha, condiciones y vigencia. Orden configurable y explicable; no adjudicar ganador por precio solo.
- La comparaci├│n muestra 2ΓÇô3 ofertas en m├│vil por tarjetas verticales, no tabla ancha; permitir ┬½Ver detalle┬╗, ┬½Hablar┬╗, ┬½Contraofertar┬╗ y **┬½Contratar┬╗** una vez aceptadas las condiciones.
- Cada oferta puede iniciar su conversaci├│n `client Γåö provider` propia; otros proveedores no pueden ver propuestas privadas ni los datos del cliente; precio de referencia del anuncio puede ser p├║blico solo cuando el cliente lo autoriz├│.
- La aceptaci├│n de UNA oferta realiza at├│micamente: validar solicitud abierta, oferta vigente, proveedor autorizado, capacidad/agenda y ├║ltima versi├│n; insertar UN `Job`; marcar solicitud ┬½cubierta/adjudicada┬╗; cerrar/superseder otras ofertas para contrataci├│n de una sola plaza; avisar cordialmente a los no elegidos. **Si el usuario pidi├│ varias plazas, modelarlas expl├¡citamente como unidades separadas; nunca adjudicar dos por carrera de dos clics.**
- Cancelaci├│n/archivo/vencimiento de solicitud abierta NO cancela trabajos ya contratados. ┬½Editar┬╗ cambios materiales invalida ofertas que depend├¡an de los t├⌐rminos anteriores o pide reconfirmaci├│n.
- Permitir optar por *invitaci├│n a proveedores seleccionados* como subflujo futuro de esta B; no ampliar alcance sin necesidad.

## B4. Estados propuestos (en un dominio independiente)
`DRAFT ΓåÆ OPEN ΓåÆ AWARDED | CLOSED_WITHOUT_HIRE | CANCELLED | EXPIRED | MODERATION_HOLD`.
Ofertas: `DRAFT ΓåÆ SUBMITTED ΓåÆ COUNTERED | ACCEPTED | REJECTED | WITHDRAWN | EXPIRED | SUPERSEDED`.

**No sustituir los `proposal_status` legacy sin plan:** mapear/adaptar las ofertas a `proposals` versionadas donde sea compatible; las necesidades abiertas nuevas requieren entidad `service_requests` y relaci├│n de m├║ltiples ofertas, no fingir que son una sola conversaci├│n con varios proveedores ni crear un servicio falso publicado por el cliente.

# 4. CONTRATACI├ôN ΓÇö CONTRATO ├ÜNICO PARA A Y B

En ambos sistemas, ANTES de confirmar mostrar un **resumen congelado**:
- nombre y avatar de ambas partes;
- servicio/solicitud origen, versi├│n aceptada, descripci├│n/alcance, materiales, exclusiones;
- modalidad *del trabajo* (`IN_PERSON` o `REMOTE`; `BOTH` en servicio obliga elegir una al contratar), zona y direcci├│n exacta solo revelada al proveedor contratado seg├║n reglas de privacidad;
- precio final en ARS, unidad, cantidad y desglose; si precio no est├í cerrado **no se puede confirmar**;
- horario/franja/fecha l├¡mite o ┬½A coordinar┬╗ con compromiso de acordarlo antes de iniciar; pol├¡tica de cancelaci├│n visible (nunca tarifa inventada);
- **┬½Esta contrataci├│n no realiza ning├║n cobro. El pago se acordar├í entre ustedes fuera de YALO y podr├í declararse aqu├¡┬╗**.

**Una sola CTA:** ┬½Confirmar contrataci├│n┬╗ o ┬½Confirmar reserva┬╗ seg├║n caso. Aceptaci├│n at├│mica server-authoritative, idempotency key estable por solicitud/propuesta/actor, protecci├│n frente a doble click/reintento, compare-and-swap de versi├│n y lock de capacidad/agenda. Confirmaci├│n visual, enlace inmediato a ┬½Seguimiento┬╗.

**Se mantiene:** `CONFIRMED` como estado inicial de `Job`; \`payment_attempt_id\` nullable. Ning├║n trabajo nace por mensaje de chat o pulsar ┬½Consultar┬╗. Dar nombre legible al evento y a los participantes.

# 5. TRABAJO ACTIVO ΓÇö DOS VISTAS, UN ESTADO

| Estado negocio existente | Cliente: ┬½Qu├⌐ sigue┬╗ y CTA | Prestador: ┬½Qu├⌐ sigue┬╗ y CTA | Notificaci├│n/evento |
|---|---|---|---|
| `CONFIRMED` sin agenda concreta | ┬½Acordar fecha┬╗ ΓåÆ coordinar | ┬½Proponer horario┬╗ | Confirmaci├│n + coordinaci├│n |
| `CONFIRMED` con fecha | ┬½Trabajo programado┬╗; chat y detalles | ┬½Iniciar trabajo┬╗ solo cuando corresponde | Recordatorio pertinente; no asegurar llegada |
| `IN_PROGRESS` | ┬½Trabajo en curso┬╗; chat, ayuda, revisar cambios | ┬½Registrar avance┬╗ / ┬½Preparar entrega┬╗ | Inicio y cambios relevantes |
| `COMPLETION_REQUESTED` | ┬½Revisar entrega┬╗ ΓåÆ Confirmar / Pedir correcci├│n / Reportar problema | ┬½Esperando revisi├│n┬╗; ver entrega | Solicitud de revisi├│n y plazo expl├¡cito |
| `COMPLETED` | ┬½Trabajo completado┬╗; pago externo + rese├▒ar | ┬½Trabajo completado┬╗; registrar cobro externo | Cierre; feedback/conciliaci├│n separados |
| `DISPUTED` | ┬½Caso en revisi├│n┬╗, aportar evidencia | Igual, responder | Ticket y plazos/revisi├│n |
| `CANCELLED` / `NO_SHOW` | Motivo, qui├⌐n lo registr├│, ayuda | Igual | Cancelaci├│n/ausencia, no emitir cobro |
| `EXPIRED` | ┬½Venci├│ sin iniciar┬╗, si aplica | Igual | Vencimiento sin reclamaciones autom├íticas |

**UI ├║nica para todos:** arriba estado legible, contraparte, fecha y monto; al centro **un CTA principal de rol**, bloque ┬½Esperando a X┬╗ y pr├│ximo hito; abajo chat, resumen de acuerdo, archivos de entrega, cambios aprobados, agenda, ayuda e historial expandible. No insertar pasos financieros en el progreso de ejecuci├│n. El chat sirve para coordinar; el contrato no queda enterrado entre 200 mensajes.

**Presencial:** ┬½En camino┬╗ se permite solo como actualizaci├│n manual opcional veraz; no inventar GPS, ETA ni seguimiento de ubicaci├│n en vivo. **Remoto:** no presentar ┬½cuando llegues┬╗, ┬½direcci├│n┬╗, ┬½mostr├í PIN┬╗; ofrecer ┬½Comenzar tarea┬╗ y carga de entregables.

**Reprogramaciones:** propuesta de fecha de una parte ΓåÆ otra acepta/rechaza ΓåÆ snapshot/agenda cambia al aceptar; prevenir solapamiento de agenda simult├íneo. Si rechazo, conservar fecha anterior sin sobrescribirla.

**Cambios de alcance:** proponer ajuste con descripci├│n, coste adicional o descuento, plazo modificado, justificaci├│n; aceptar expresamente antes de ejecutar/cobrar. Consentimiento y versi├│n auditables. Si no hay acuerdo, mantener lo original o cancelar/resolver por las reglas, no forzar pago. Con pagos online OFF, un adicional aceptado se agrega al **monto acordado externo**, NO a una solicitud de ┬½Pagar adicional con MP┬╗ ni a `AWAITING_PAYMENT` como bloqueo imposible.

# 6. ENTREGA Y FINALIZACI├ôN ΓÇö DECISI├ôN D3

## 6A. Presencial (PIN para constancia de entrega)
1. Prestador pulsa **┬½Solicitar revisi├│n┬╗** cuando sostiene que termin├│. Puede adjuntar pruebas opcionales no invasivas y resumen. No puede marcar `COMPLETED` unilateralmente.
2. Cliente recibe ┬½El prestador dice que termin├│. Revis├í el resultado antes de compartir el PIN┬╗. Cliente consulta alcance/fotos/resultado.
3. Si lo recibido corresponde a la entrega f├¡sica acordada, **el cliente comparte el PIN presencial de forma voluntaria**. El prestador lo introduce para dejar constancia de la entrega; 4 d├¡gitos solo mientras exista protecci├│n real de intentos, caducidad/rotaci├│n apropiada y privacidad por roles.
4. **El PIN no equivale a conformidad definitiva ni a pago.** El cliente ve una acci├│n clara, separada: ┬½Confirmar trabajo terminado┬╗. Alternativas ┬½Necesito una correcci├│n┬╗ y ┬½Reportar problema┬╗ siempre visibles durante ventana elegible.
5. Despu├⌐s de confirmar ΓåÆ `COMPLETED`. Si el PIN ya se valid├│, explicar por qu├⌐ queda la revisi├│n final; evitar que parezca doble validaci├│n redundante.

**Compatibilidad con el estado actual:** hoy `request_job_completion(uuid,text)` valida PIN antes de mover `IN_PROGRESS ΓåÆ COMPLETION_REQUESTED`. Para respetar ┬½revisar antes de compartir┬╗, el SPEC exige desacoplar **solicitud de revisi├│n** de **verificaci├│n presencial** y de **confirmaci├│n final**. Un esquema v├ílido agrega campos/eventos `delivery_submitted_at` y `handover_verified_at` sin inventar nuevos `job_status` globales si no hacen falta. No convertir el PIN en aceptaci├│n final por atajo y no romper el rate-limit/autoridad ├║nica ya implementados en producci├│n.

**Si no hubo interacci├│n f├¡sica al final** (servicio en domicilio sin cliente presente): ofrecer confirmaci├│n digital del cliente con evidencia y, si es imprescindible, mediaci├│n, **no obligar a revelar PIN por chat o forzar una entrega ficticia**. Si el cliente no comparte PIN por disconformidad, la UI debe permitir correcci├│n/disputa; no revelar el PIN al proveedor mediante RLS o RPC.

## 6B. Remoto (entrega digital, sin PIN)
1. Prestador pulsa ┬½Entregar trabajo┬╗: resumen, archivos/enlaces necesarios o evidencia verificable seg├║n categor├¡a; marcar `delivery_submitted_at`, versi├│n y deadline de revisi├│n. **No pedir PIN**.
2. Cliente recibe notificaci├│n con acceso directo a entregables; ┬½Revisar┬╗, ┬½Pedir correcci├│n┬╗ (con motivo) o ┬½Confirmar trabajo terminado┬╗.
3. La correcci├│n reabre la revisi├│n/recibe nueva versi├│n con historial; limitar loops abusivos mediante incidente/soporte, **sin borrar versiones previas**.
4. Solo confirmaci├│n digital expl├¡cita o autocierre bajo pol├¡tica indicada lleva a `COMPLETED`. Los archivos no deber├¡an perderse al terminar un contrato ni quedar p├║blicos.

## 6C. Plazo, silencio y autocierre
**Default propuesto, pendiente de validaci├│n operacional sin bloquear maquetaci├│n:** esperar hasta **7 d├¡as** de `COMPLETION_REQUESTED`, recordatorios ├║tiles y espaciados (ej. 24 h y 72 h), luego cierre autom├ítico SOLO si existe evidencia v├ílida de entrega y ausencia de disputa/correcci├│n abierta; dar **7 d├¡as** adicionales para apelar un autocierre si as├¡ lo permiten las reglas vigentes.
- El cron SQL actual ya tiene l├│gica de 7 d├¡as/autocierre + apelaci├│n en algunas situaciones; se debe comprobar que se adapta a modalidad y pruebas de entrega, **no reutilizar cron ciegamente**.
- Si no hay prueba de entrega, no cerrar por el mero paso del tiempo: notificar ambas partes y abrir v├¡a de soporte.
- Conflictos: disputa/cancelaci├│n/solicitud de correcci├│n bloquean autocierre; condiciones revalidadas bajo lock para que cron no pise cambios concurrentes.
- La falta de respuesta NO confirma ni prueba el pago externo.

# 7. DINERO FUERA DE YALO ΓÇö DECISI├ôN D4 (EL CAMBIO CON MAYOR IMPACTO)

## 7.1 Contrato de verdad financiera
**Frases obligatorias:** ┬½Acordado┬╗, ┬½Declarado por cliente┬╗, ┬½Declarado por prestador┬╗, ┬½Pendiente de confirmaci├│n┬╗, ┬½Confirmado por ambas partes┬╗, ┬½En desacuerdo┬╗. Jam├ís ┬½Pago verificado por YALO┬╗ sin una fuente t├⌐cnica autorizada (que HOY NO existe).

Mientras los flags de pagos online est├⌐n OFF:
- No pedir conectar Mercado Pago, no crear checkout, no invocar webhook como consecuencia de una declaraci├│n, no producir receipts o documentos que aparenten comprobante bancario emitido por YALO.
- Mostrar ┬½Pueden acordar efectivo o transferencia directamente. YALO no recibe ni custodia el dinero; registr├í lo pagado para llevar el control┬╗. No publicar datos bancarios ni tel├⌐fonos en el marketplace abierto; jam├ís solicitar CVV, contrase├▒as, token bancario, OTP bancario o datos de tarjeta.
- Contratar **sin adelanto exigido**; si acuerdan un anticipo externo en una fase posterior, requiere cl├íusulas, consentimiento claro y control separado. **En v1.0 no incorporar anticipos obligatorios.**
- Una comisi├│n de YALO que figure en cat├ílogos puede ser orientaci├│n comercial, pero no afirmar que ha sido cobrada/descontada; definir modelo de comisi├│n externa y documentaci├│n legal antes de usar cifras/compensaciones autom├íticas.

## 7.2 Declaraci├│n y conciliaci├│n bilateral (nuevos objetos; no usar ┬½FAKE┬╗)
**Primera versi├│n recomendada:**
1. En trabajo `COMPLETED` aparece tarjeta ┬½Pago entre ustedes┬╗, con **importe del acuerdo + extras aprobados**, acumulado confirmado, saldo y m├⌐todo informado. Si hay pagos externos parciales permitidos, indicar monto y saldo; v1 permite m├║ltiples abonos de forma opcional si se implementa bien el ledger.
2. Cliente pulsa **┬½Informar que pagu├⌐┬╗**: importe (por defecto saldo), m├⌐todo `EFECTIVO` / `TRANSFERENCIA` / `OTRO ACORDADO`, fecha aproximada, referencia opcional y comprobante **privado** opcional. Confirmaci├│n: ┬½Esta declaraci├│n se enviar├í al prestador; todav├¡a no significa que est├⌐ confirmado┬╗.
3. Prestador ve **┬½El cliente inform├│ un pago de $X┬╗** ΓåÆ **┬½Confirmar que lo recib├¡┬╗** / **┬½No lo recib├¡┬╗** (motivo opcional, enlace a soporte). Solo confirmaci├│n positiva del receptor cambia ese abono a **CONFIRMED_BY_BOTH**.
4. Prestador tambi├⌐n puede iniciar ┬½Registrar dinero recibido┬╗, pero requiere confirmaci├│n del cliente para reconciliar, y jam├ís se auto-confirma por ser el destinatario.
5. Ambos ven el historial completo de declaraciones, respuestas y ediciones; nunca sobrescribir eventos auditables. Correcciones se hacen con `void/supersede` y nuevo registro, sin borrado silencioso.
6. Si conflicto: `CONTESTED` y soporte, congelar cierre financiero sin revertir autom├íticamente el trabajo `COMPLETED`. Separar un ticket de disputa de pago externo de una disputa de calidad. YALO puede mediar en informaci├│n de su plataforma, **no garantizar reintegro** de transferencia/efectivo externa.

**Estados por cada pago externo:** `DECLARED_BY_CLIENT | DECLARED_BY_PROVIDER ΓåÆ AWAITING_COUNTERPARTY ΓåÆ CONFIRMED_BY_BOTH | CONTESTED | VOIDED`. **Ledger:** `agreed_total_minor`, `external_confirmed_minor`, `external_claimed_minor`, `external_outstanding_minor = max(agreed - confirmed,0)`. No permitir confirmed_amount > agreed sin versi├│n aprobada; no sumar dos veces declaraciones rec├¡procas; compensaciones/reembolsos externos se anotan expl├¡citamente y no se equiparan a refund procesado.

**Estados visuales del trabajo vs dinero:** trabajo puede estar `COMPLETED` y pago `UNREPORTED/PARTIAL/DECLARED/CONFIRMED/CONTESTED`. Solo el ├║ltimo puede mostrarse ┬½Pago externo confirmado por ambas partes┬╗. No convertir `job_settlement_attempts` con provider `FAKE` ni `settlement_status=SETTLED` en evidencia bancaria de una transferencia.

## 7.3 Reglas de seguridad/privacidad
- RPC/RLS per-job: SOLO cliente, proveedor del trabajo y admin autorizado pueden ver declaraciones/comprobantes; service_role internamente sin filtraci├│n p├║blica; evidencia privada con URL temporal firmada, no logs con PII ni URL expuesta.
- Validaci├│n de tipo/tama├▒o de adjuntos y contenido; minimizaci├│n de referencias bancarias; retenci├│n/eliminaci├│n conforme pol├¡ticas; no mostrar CLABE/CBU/alias/datos sensibles p├║blicamente.
- Idempotencia por declaraci├│n, l├¡mites antifraude/anti-spam; comprobantes aportados por usuarios se marcan ┬½No verificados por YALO┬╗.
- No activar conciliaci├│n autom├ítica de pagos reales al migrar a MP: trabajos con saldo externo ya confirmado deben quedar **excluidos** de checkout futuro para no cobrar dos veces; casos de declaraciones disputadas requieren revisi├│n espec├¡fica.
- Diferenciar actividad externa real y simulaci├│n admin en analytics, UI y reportes, con labels expl├¡citos.

## 7.4 Copy de pagos que corregir YA
**Evidencia concreta en main:** `apps/web/src/app/p/[slug]/[serviceSlug]/page.tsx` hoy dice ┬½Pag├ís al finalizar desde YALO┬╗ y ┬½Comisi├│n de YALO incluida en el total┬╗; no es correcto con D4 + pagos OFF. **Otro bloqueo P0 de copy:** `apps/web/src/lib/ui/guided.ts` mantiene `getProviderNextAction()` ΓåÆ ┬½Conect├í tu cobro┬╗, ┬½Sin esto no pod├⌐s cobrar┬╗, ┬½Conectar Mercado Pago┬╗ cuando `paymentConnected=false`, incluso con `PAYMENTS_ENABLED=false`; `getClientNextAction()` ΓåÆ ┬½Ten├⌐s un pago pendiente┬╗ y ┬½Ir a pagar┬╗ ante `pendingPayment=true`, aunque no hay checkout. Sus callers actuales en `apps/web/src/app/(provider)/provider/manage/page.tsx` y `apps/web/src/app/(account)/jobs/page.tsx` no pasan el flag. Tambi├⌐n `CLIENT_HIRE_STEPS` termina con ┬½Pag├í┬╗ sin aclarar que el pago es externo. Corregir utilidades, callers, tests y el panel de Mercado Pago para que la gu├¡a principal promueva el cobro externo declarado, nunca la vinculaci├│n obligatoria, y para que se pueda trabajar sin cuenta MP. Cambiarlo por ┬½Acord├ís el precio al contratar. El pago se realiza directamente entre las partes; YALO permite registrar lo declarado┬╗ y aclaraci├│n contractual real de comisi├│n, sin prometer cobro dentro de app.
- `apps/web/src/components/jobs/job-tracking.ts` ya comunica ┬½pago online pendiente de habilitaci├│n┬╗ pero debe ahora dirigir al registro **externo declarado** despu├⌐s de cerrar, en vez de solo una deuda inoperable.
- Historial `/jobs`: ┬½Pendiente de pago┬╗ pasa a ┬½Pago externo sin confirmar┬╗ donde corresponda, no reclamar mora; no es v├ílido inferir deuda si ya informaron pagos externos a├║n sin reconciliar.

# 8. DISPUTAS, CANCELACI├ôN Y AUSENCIAS (NO PUEDE HABER CALLES SIN SALIDA)

| Caso | Acci├│n permitida | Efecto |
|---|---|---|
| Consulta/oferta sin respuesta | Ver pendiente, retirar, editar, reenviar con l├¡mite, caducidad explicada | Sin trabajo creado |
| Propuesta vencida | No aceptar; pedir nueva o contraofertar nuevos t├⌐rminos | No resurrect vencida |
| Reserva de horario ocupado | Rechazo transaccional y alternativas | No doble booking |
| Cliente cancela antes de iniciar | ┬½Cancelar solicitud/trabajo┬╗ + motivo | `CANCELLED`; no inventar penalidad |
| Prestador cancela | Explicar al cliente + alternativas/reiniciar b├║squeda | `CANCELLED`; reputaci├│n/disciplina solo seg├║n pol├¡tica futura |
| No-show presencial | Registrar ausencia con fecha, contexto y evidencia opcional, avisar contraparte | `NO_SHOW` s├│lo tras ventana/pol├¡tica objetiva; disputable |
| Cambio agenda | Solicitar/aceptar/rechazar; conservar fecha si rechazo | Evento auditable |
| Trabajo incompleto/da├▒ado | ┬½Solicitar correcci├│n┬╗ o ┬½Reportar problema┬╗ con evidencia | Congelar autocierre; soporte |
| Prestador dice entregado, cliente niega | Disputa de entrega/calidad, revisar evidencia y PIN si hubo | NUNCA auto-confirmar calidad ni pago |
| Pago externo declarado, receptor niega | ┬½No lo recib├¡┬╗ ΓåÆ `CONTESTED` | Registro financiero en disputa; no prometer recuperaci├│n de fondos |
| Cuenta bloqueada/suspendida | Preservar acceso limitado a documentaci├│n de trabajos previos y canal de soporte seg├║n permisos | No permitir nuevas contrataciones |
| Fraude/acoso | Bloquear/reportar, ocultar datos y activar moderaci├│n | Respeta seguridad sin borrar evidencia |

**Reglas pendientes de pol├¡tica comercial y NO inventadas en esta SPEC:** penalizaciones, anticipo, dep├│sito, reembolsos, plazos legales de pago, garant├¡as y sanciones. En v1 **no aplicarlos autom├íticamente**. Administraci├│n debe disponer de trazabilidad y decisiones auditables; una disputa no se cierra en silencio tras marcar estado.

# 9. PANTALLAS OBLIGATORIAS Y MAPA DE NAVEGACI├ôN

**Sitio p├║blico**
- `/` ΓÇö dos CTAs bien diferenciados ┬½Buscar servicios┬╗ y ┬½Publicar lo que necesit├ís┬╗; marca YALO; b├║squeda prominentemente.
- `/buscar` ΓÇö cards de servicios, filtros modalidad/zona/precio, b├║squeda clara; entrada secundaria a solicitudes p├║blicas para prestadores autorizados.
- `/p/[slug]`, `/p/[slug]/[serviceSlug]` ΓÇö confianza, condiciones y CTA correcta seg├║n modalidad econ├│mica/instant booking.

**Cuenta cliente**
- NUEVA `/solicitudes/nueva` ΓÇö wizard de publicaci├│n con borrador recuperable.
- NUEVA `/solicitudes` ΓÇö ┬½Borradores┬╗, ┬½Publicadas┬╗, ┬½Esperando propuestas┬╗, ┬½Eleg├¡ prestador┬╗, ┬½Cerradas┬╗.
- NUEVA `/solicitudes/[id]` ΓÇö resumen, visibilidad/editar, comparador de propuestas, se├▒ales de seguridad, candidatos e historial.
- `/messages` + `/messages/[conversationId]` ΓÇö cotizaci├│n y comunicaci├│n 1:1, propuesta resumida anclada.
- `/jobs` ΓÇö pesta├▒a ┬½Activos┬╗ correctamente rotulada y ┬½Historial┬╗, ┬½Por revisar┬╗, no ┬½Todos┬╗ si excluye terminados.
- `/jobs/[jobId]` ΓÇö ┬½Qu├⌐ sigue┬╗, contrato, entrega, confirmaci├│n, ayudas, pago externo, rese├▒a.

**Cuenta prestadora**
- `/provider/onboarding` y etapas ΓÇö CTA real de alta, requisitos verificados; **el paso 4 ┬½Revisar y enviar┬╗ debe ENVIAR desde esa pantalla**, no devolver a Documentos como CTA principal.
- `/provider/manage` ΓÇö cat├ílogo, disponibilidad preautorizada para instant booking, agenda y solicitudes.
- NUEVA `/oportunidades` ΓÇö tablero de solicitudes compatibles y CTA proponer/declinar.
- NUEVA `/oportunidades/[id]` ΓÇö detalles permitidos, privacidad y env├¡o de oferta.
- `/messages` ΓÇö consultas/contraofertas.
- `/jobs` y detalle ΓÇö misma m├íquina de estados, copy CTA prestador y registro de cobro externo.

**Ambos roles, misma cuenta:** navegaci├│n contextual ┬½Contratar / Ofrecer┬╗ o entradas claras, NO dos cuentas ni conversi├│n destructiva. Notificaciones/badges deben indicar acciones pendientes sin confundir roles. En mobile bottom-nav seleccionar un destino estable y mostrar las otras entradas en un men├║ visible, sin 8 tabs apiladas.

### Pantalla can├│nica de trabajo ΓÇö composici├│n
1. App bar: volver + servicio + men├║ ayuda.
2. Encabezado: contraparte, foto, badge estado, coste acordado.
3. Hero ┬½Qu├⌐ sigue┬╗ + CTA de rol (o mensaje ┬½Esperando aΓÇª┬╗).
4. Secci├│n ┬½Entrega/Correcciones┬╗ visible SOLO cuando aplica; PIN no expuesto al prestador.
5. Secci├│n ┬½Acuerdo┬╗ con versi├│n aceptada y cambios; horarios.
6. Secci├│n ┬½Pago entre ustedes┬╗ independiente de progreso del trabajo; CTA declarar/confirmar/disputar.
7. Chat y ayuda siempre accesibles; historial en acorde├│n, sin logs t├⌐cnicos.
8. Rese├▒a solo para `COMPLETED` y reglas antimanipulaci├│n existentes.

# 10. MATRIZ DE AUTORIZACIONES POR ACTOR

| Acci├│n | Cliente due├▒o | Prestador asignado | Otro prestador compatible | An├│nimo | Admin |
|---|---:|---:|---:|---:|---:|
| Explorar perfiles/servicios p├║blicos | S├¡ | S├¡ | S├¡ | S├¡ | S├¡ |
| Crear solicitud abierta | S├¡ | S├¡ si act├║a como cliente | S├¡ si act├║a como cliente | No (borrador local s├¡) | Seg├║n rol |
| Leer detalles p├║blicos de solicitud | S├¡ | Si autorizada/compatible | Si autorizada/compatible | Solo si pol├¡tica p├║blica permite datos m├¡nimos | Seg├║n moderaci├│n |
| Ver direcci├│n exacta/adjuntos privados | Solo su solicitud/trabajo | Solo si contratado o consentimiento espec├¡fico | **No** | No | Justificaci├│n, registro |
| Ofertar en solicitud abierta | No como prestador de s├¡ mismo | S├¡ si ACTIVE, elegible, no bloqueado | S├¡ si elegible | No | No fingir proveedor |
| Ver todas las ofertas de una solicitud | S├¡ | Solo su oferta | Solo su oferta | No | S├¡ por moderaci├│n |
| Aceptar oferta/crear contrato | S├¡ | No salvo reserva previamente preautorizada seg├║n RPC | No | No | No simular aceptaci├│n |
| Iniciar y solicitar revisi├│n de trabajo | No | S├¡ | No | No | Acci├│n especial auditada |
| Compartir/visualizar PIN presencial | S├¡ | **Nunca leer PIN**; solo enviar intento | No | No | Acceso excepcional auditado |
| Confirmar calidad del trabajo | S├¡ | No | No | No | Resoluci├│n excepcional |
| Declarar pago emitido/recibido | S├¡ | S├¡ | No | No | Registro administrativo expl├¡cito |
| Confirmar recepci├│n de dinero | No (si paga) | S├¡ (receptor) | No | No | No simular conformidad |
| Impugnar declaraci├│n de pago | S├¡ | S├¡ | No | No | Intervenir v├¡a proceso |
| Ver evidencia/denuncias | Participantes seg├║n privacidad | Participantes seg├║n privacidad | No | No | M├¡nimo necesario/auditado |

**Autoridad siempre server-side:** IDOR, RLS, SECURITY DEFINER, actor/estado/versi├│n, carrera de dos sesiones, rate limit, bloqueo. El frontend solo acompa├▒a y nunca sustituye permisos de DB.

# 11. MATRIZ DE TRANSICIONES Y CONSISTENCIA

## 11.1 Estado de consulta (nuevo)
`OPEN ΓåÆ AWARDED` exclusivamente al confirmar un contrato v├ílido. `OPEN ΓåÆ CANCELLED/EXPIRED/CLOSED_WITHOUT_HIRE` bajo actor/pol├¡tica. No revivir oferta vencida sin nueva versi├│n. `AWARDED` jam├ís admite segunda plaza si `capacity=1`.

## 11.2 Propuesta
`OPEN ΓåÆ ACCEPTED / REJECTED / WITHDRAWN / EXPIRED`; revisiones/contraofertas generan versi├│n nueva y vuelven a exigir aceptaci├│n del destinatario. Solo `ACCEPTED` con precio/alcance snapshot completo permite crear trabajo. Mantener legado `DIRECT_BOOKING` ├║nicamente con preautorizaci├│n real.

## 11.3 Trabajo
`CONFIRMED ΓåÆ IN_PROGRESS ΓåÆ COMPLETION_REQUESTED ΓåÆ COMPLETED`.
En presencial, verificar constancia PIN como **evento/atributo independiente** antes de la confirmaci├│n del cliente, con alternativa digital/mediaci├│n justificada; remoto no solicita PIN.
Excepciones desde estados elegibles: `CANCELLED`, `DISPUTED`, `NO_SHOW`, `EXPIRED`. Autocierre exige evidencia y carrera segura. No permitir combinaciones imposibles (ej. `COMPLETED` sin entrega/autocierre o doble `Job` por una oferta).
`COMPLETED` puede cambiar a `DISPUTED` durante apelaci├│n v├ílida de autocierre; preservar historial y derechos.

## 11.4 Pago externo
Separado del job: `NOT_REPORTED ΓåÆ DECLARED ΓåÆ CONFIRMED_BY_BOTH`; `DECLARED ΓåÆ CONTESTED/VOIDED`; m├║ltiples abonos llevan a `PARTIAL_CONFIRMED` o `FULL_CONFIRMED`. NUNCA poner `SETTLED` de Mercado Pago sobre la base de un screenshot o declaraci├│n. Admin no debe manipular balances con provider FAKE para representar efectivo real.

## 11.5 Invariantes de datos indispensables
- Una sola aceptaci├│n ganadora por solicitud de una plaza; un solo trabajo por propuesta aceptada.
- Una sola capacidad/reserva por slot; bloqueo y validaci├│n bajo transacci├│n.
- Snapshot de precio/alcance/fecha/modo inmutable por versi├│n aceptada; modificaciones versionadas.
- No cobrar por automatismos con `PAYMENTS_ENABLED=false`; no publicar informaci├│n privada de solicitudes.
- C├│digo de entrega no expuesto a quien lo valida; l├¡mite de intentos aplicado en el RPC de autoridad (ya resuelto en PR #22; conservar/regresar tests).
- Declaraciones externas no sustituyen estados de pago online ni activan checkout futuro.
- Eventos durables y deduplicados por `idempotency_key`, con actor, timestamp, versi├│n y motivo cuando corresponda.

# 12. NOTIFICACIONES, SE├æALES Y TIMEOUTS

| Evento | Destinatario | Acci├│n de notificaci├│n |
|---|---|---|
| Nueva consulta dirigida | Prestador | ┬½Respond├⌐ consulta┬╗ ΓåÆ conversaci├│n/resumen |
| Nueva solicitud abierta compatible | Prestadores que opten por alertas | Digest pertinente, no push masivo ni direcci├│n privada |
| Nueva oferta o contraoferta | Cliente / contraparte | ┬½Revisar condiciones┬╗ |
| Contrataci├│n confirmada | Ambas partes | ┬½Ver trabajo┬╗ |
| Propuesta de reprogramaci├│n | Contraparte | ┬½Aceptar o rechazar fecha┬╗ |
| Cambio de alcance | Contraparte | ┬½Revisar precio y alcance┬╗ |
| Trabajo iniciado | Cliente | ┬½Ver seguimiento┬╗ |
| Entrega/revisi├│n solicitada | Cliente | ┬½Revisar trabajo┬╗ (y evidencia) |
| Correcci├│n/disputa | Contraparte y admin si aplica | ┬½Responder/ver caso┬╗ |
| Autocierre posible | Cliente | Recordatorios previos y ventana de apelaci├│n clara |
| Pago externo declarado | Contraparte | ┬½Confirmar recepci├│n / confirmar que pagu├⌐┬╗ |
| Pago externo discutido | Ambas partes y soporte | ┬½Ver desacuerdo┬╗ |
| Nueva rese├▒a/respuesta | Prestador / cliente | ┬½Ver rese├▒a┬╗ |

- Notificaci├│n push/correo tiene URL can├│nica, deduplicaci├│n, permiso/opt-in y preferencias existentes. No avisar ┬½deuda exigible┬╗ ni ┬½cobro garantizado┬╗ con pagos offline.
- Plazos por defecto: propuestas abiertas **7 d├¡as** si emisor no eligi├│ vencimiento; avisar antes; solicitudes abiertas **14 d├¡as** y archivar con reabrir sujeto a reglas; revisi├│n final **7 d├¡as** y apelaci├│n de autocierre **7 d├¡as**. **Son defaults propuestos por SPEC, no condiciones legales ni SLA**: configuraci├│n administrable por tipo de servicio/ciudad y pruebas; no aplicar penalidades autom├íticas por vencer.
- Programaci├│n: usar zona del trabajo (ej. America/Argentina/Buenos_Aires), guardar UTC, mostrar TZ en UI si cliente/prestador est├ín en regiones distintas.
- Avisos de ausencia antes de penalizaci├│n solo despu├⌐s de una ventana operativa publicada; no copiar 5 minutos de PedidosYa a un plomero.

# 13. COMPONENTES UI/UX Y ACCESIBILIDAD PREMIUM

- **Un solo CTA primario por estado**; secundarias discretas, acci├│n destructiva con confirmaci├│n, soporte contextual.
- Formularios: m├íximo 3 decisiones visibles por pantalla antes de expandir opcionales, t├¡tulos naturales, ejemplo de necesidad bien redactada, validaci├│n inline, no perder texto al error/refresh/atr├ís.
- Propuestas: tarjeta comparable y fechas v├ílidas, vista hist├│rica de versiones; doble pulsaci├│n no crea segundo contrato.
- Mensajer├¡a: conservar scroll al cargar p├íginas anteriores, no forzar al final si leyendo arriba, nuevos mensajes badge; adjuntos con progreso/reintento y error visible; teclado Android/safe-area.
- Dise├▒o YALO: tokens navy/cyan/teal/mint, contrastes WCAG AA, claro/oscuro/sistema, no residuos naranjas ni degradados sin prop├│sito; tipograf├¡a legible, 44ΓÇô48 px t├íctiles.
- Presencial: ubicaci├│n aproximada antes de contrato, exacta solo tras contratar y con necesidad operacional; por defecto sin tracking GPS. Remoto: sin mapas ni PIN.
- Estados vac├¡os con acciones (┬½A├║n no recibiste ofertas; ajust├í tu solicitud o compartila┬╗); jam├ís resultados truncados por paginar despu├⌐s de filtrar.
- Evitar ┬½Todos┬╗ cuando `/jobs` trae solo activos; renombrar o combinar activos+hist├│rico correctamente.
- Paso final onboarding: bot├│n ┬½Enviar a revisi├│n┬╗ vive realmente en paso 4 con resumen.
- PWA: actualizar capturas de instalaci├│n tras rebrand, inspeccionar wordmark YALO **provisional** y conseguir master aprobado; dark mode, splash, OG, icon maskable y cach├⌐ segura.
- Rendimiento: medir Web Vitals/Lighthouse en m├│viles representativos y establecer baselines; no imponer puntuaciones sin medir. Probar 360/390/412, 768/1280, teclado, zoom 200 %, screen readers, baja conectividad y reconexi├│n.

# 14. DISE├æO T├ëCNICO ΓÇö SUGERIDO, NO SQL PARA EJECUTAR

### Entidades nuevas (solo propuesta de modelo; verificar contra hist├│rico remoto)
1. `service_requests` (client, title, description, category, modality, zone/coarse_geo, schedule, price_hint, state, visibility, expires, version, idempotency).
2. `service_request_attachments` en storage privado o p├║blico cuidadosamente clasificado; never exact address.
3. `request_proposals` puente solicitudΓåöproposalΓåöprovider con aislamiento per-actor; ideal reutilizar `proposals/proposal_versions` en vez de duplicar reglas.
4. `request_awards` (request_id, winning_proposal, job_id, slot_id) con unique por plaza/capacidad; constraints transaccionales.
5. `job_deliveries` (job, revision, modality, submitted_by, timestamps, evidence, review status) y `job_handover_verifications` (PIN event sin revelar secreto).
6. `external_payment_declarations` y `external_payment_events` append-only con actor, amount_minor, method, private_receipt_ref, dispute status, reconciled amount; no confundir con `job_settlement_attempts` ni `provider_payment_accounts`.
7. Agregados autorizados para pendientes de cada rol; ├¡ndices para listas y filtros; outbox de notificaciones existentes.

**Transici├│n del sistema actual:** no reescribir todo; adaptar rutas legacy `/p/...`, `/messages`, `/jobs` y `Job`. Crear request abierta detr├ís de feature flag propia (`PUBLIC_REQUESTS_ENABLED`) hasta probar B. Mantener pagos online OFF. Migration SQL append-only sin `supabase db push` contra el remoto con 58 migraciones hist├│ricas ausentes del repo. Hacer comparaciones de firmas antes de reemplazar RPCs y comprobar grants/RLS.

**Decisi├│n de arquitectura prioritaria:** no usar una conversaci├│n con N proveedores; el agregado `ServiceRequest` tiene N ofertas, y cada candidato tiene vista/interacci├│n privada por separado.

# 15. MATRIZ QA END-TO-END Y SEGURIDAD

| ID | Escenario | Resultado obligatorio |
|---|---|---|
| E01 | Visitante descubre un servicio, inicia login y vuelve | Se conserva servicio, intenci├│n, borrador, sin duplicado |
| E02 | Precio fijo con reserva habilitada y slot libre | Una transacci├│n crea 1 trabajo confirmado y 1 reserva |
| E03 | Precio fijo SIN reserva habilitada | Queda solicitud para prestador; NO crea job |
| E04 | ┬½A cotizar┬╗ con fotos y fecha flexible | Solicitud y chat 1:1; cotizaci├│n con precio y alcance |
| E05 | Contraoferta, expiraci├│n, rechazo, retirada | Versiones, motivos y UX correctos, sin job espurio |
| E06 | Doble tap / dos pesta├▒as aceptan mismo presupuesto | A lo sumo un job; feedback idempotente |
| E07 | Cliente publica necesidad para varios | Recibe 3 ofertas privadas, comparables sin filtraci├│n entre proveedores |
| E08 | Dos propuestas ganadoras simult├íneas en solicitud 1 plaza | Exactamente 1 award y 1 job; segunda recibe conflicto explicable |
| E09 | Proveedor suspendido ofertando o viendo datos privados | RPC/RLS rechaza y no deja huellas de privacidad |
| E10 | Reprogramaci├│n aceptada/rechazada | Slot no se solapa; original se conserva si rechazo |
| E11 | Adicional propuesto, aceptado/rechazado | Cambia acordado solo con consentimiento; NO crea checkout MP |
| E12 | Presencial termina, cliente retiene PIN por falla | Puede pedir correcci├│n/disputa; no se completa unilateralmente |
| E13 | 5 c├│digos err├│neos y sexto v├ílido dentro de 10 min | Bloqueo real y persistente incluso por invocaci├│n RPC directa |
| E14 | Remoto entrega PDF/video/link y pide revisi├│n | Cliente revisa/aprueba/corrige sin PIN |
| E15 | Cron autocierre simult├íneo a disputa | Estado elegible con lock; no pisa disputa/correcci├│n |
| E16 | Trabajo completado, sin pago externo | Rese├▒a permitida, monto acordado visible, no ┬½Pagado┬╗ |
| E17 | Cliente declara $X transferencia con comprobante | Prestador ve ┬½pendiente de confirmaci├│n┬╗; no se acredita autom├íticamente |
| E18 | Prestador confirma recepci├│n de $X | ┬½Confirmado por ambas partes┬╗, audit log y saldo actualizado |
| E19 | Prestador niega transferencia | `CONTESTED`; no ┬½pago verificado┬╗, soporte contextual |
| E20 | Dos pagos parciales y declaraciones simult├íneas | No excede acordado ni duplica importes; reconcile correcto |
| E21 | Work ya confirmado externamente, luego habilitan MP en staging | No generar checkout doble; backfill/migraci├│n expl├¡cita |
| E22 | Cuenta A logout ΓåÆ cuenta B login en misma PWA | No fuga de trabajo, direcci├│n, PIN, chats ni comprobantes en cach├⌐ |
| E23 | 55+ jobs y 30+ conversaciones | Filtros server-side, cursors y unread agregados correctos |
| E24 | Ausencia, cancelaci├│n, desacuerdo de calidad, usuario bloqueado | Caminos de ayuda/resoluci├│n sin callej├│n sin salida |
| E25 | Pantallas mobile 360/390/412 + dark/light/zoom | Sin scroll horizontal, CTA accesible y teclado usable |
| E26 | Permisos directos RPC (anon/otro proveedor/cliente) | No puede adjudicar, cerrar, leer PIN o confirmar cobro ajeno |
| E27 | Notificaciones de pago ONLINE OFF | Sin push ┬½pag├í desde YALO┬╗, solo declaraciones externas |
| E28 | Onboarding nuevo hasta revisi├│n y ACTIVE | Paso 4 env├¡a sin volver a Documentos; verificaci├│n efectiva |

**Test fixture m├¡nimo:** cuentas A cliente, B proveedor ACTIVE, C proveedor ACTIVE, D proveedor suspendido, E admin autorizado; 2 categor├¡as (oficio presencial y tarea digital), 2 zonas, 2 servicios fijo/a cotizar, 1 solicitud p├║blica con 3 ofertas; pagos externos simulados como declaraciones **etiquetadas TEST**, jam├ís fondos reales. Usar staging autorizado, no producir contrataciones ficticias en producci├│n.

**Pruebas unitarias:** form validation, gating reservas, price math y minor units, estados y copy por rol; integration DB: locks, awards, RLS, idempotencia, PIN, read models, ledger, cron; e2e navegador: dos sesiones reales separadas + refresh/reconexi├│n y screenshots.

# 16. M├ëTRICAS DE PRODUCTO (INSTRUMENTAR, NO INVENTAR RESULTADOS)

Eventos m├¡nimos sin PII: `service_viewed`, `direct_booking_review_opened`, `service_inquiry_sent`, `request_published`, `proposal_submitted`, `proposal_viewed`, `proposal_accepted`, `job_created`, `job_started`, `delivery_submitted`, `job_confirmed`, `external_payment_declared`, `external_payment_confirmed`, `review_submitted`, `dispute_opened`.

Embudo A: vista ficha ΓåÆ consulta/reserva ΓåÆ oferta ΓåÆ contrato ΓåÆ inicio ΓåÆ entrega ΓåÆ confirmaci├│n ΓåÆ rese├▒a.
Embudo B: inicio publicaci├│n ΓåÆ publicada ΓåÆ primera oferta ΓåÆ comparaciones ΓåÆ adjudicaci├│n ΓåÆ contrato ΓåÆ ejecuci├│n.
Atribuir abandono por pantalla, errores de servidor, tiempo hasta primera respuesta, tasa de solicitud sin oferta, disputa y recontrataci├│n. **No incluir PIN, direcciones, DNI, comprobantes ni mensajes en analytics.** No fijar SLA hasta medir base.

# 17. PLAN DE IMPLEMENTACI├ôN PARA MUSE (SLICES, CON STOP OBLIGATORIO)

**REGLA:** no ejecutar todos los lotes en una sola pasada. Muse debe informar resultado y **esperar auditor├¡a/permiso** entre lotes; toda rama con base actualizada, PR revisable y tests.

**Fase S0 ΓÇö corregir contradicciones actuales (sin nuevas tablas):**
- Ficha de servicio ┬½Pag├ís desde YALO┬╗ y afirmaciones de comisi├│n sin respaldo; copy de seguimiento/pagos externos, **incluidos `getProviderNextAction`, `getClientNextAction` y `CLIENT_HIRE_STEPS` en `apps/web/src/lib/ui/guided.ts`: hoy exigen MP y dan CTA ┬½Ir a pagar┬╗ con pagos OFF**. Debe quedar testado que un prestador ACTIVE con servicio y sin MP puede trabajar y recibir dinero por fuera, y el cliente puede declarar pago externo, no pulsar un checkout imposible.
- Filtro ┬½Todos┬╗, paso 4 onboarding, residuos de color YALO, screenshots PWA y revisi├│n del lettering con master.
- Asegurar que no aparecen CTAs checkout/MP con flags OFF y ninguna notificaci├│n de pago imposible.
**Gate:** copy 100% coherente D4 y capturas mobile, sin regresiones de contrataci├│n actual. No activar B todav├¡a.

**Fase S1 ΓÇö endurecer camino A:**
- Preautorizaci├│n expl├¡cita de reserva directa con disponibilidad/capacidad bajo lock, transici├│n de aceptaci├│n bilateral cuando falta.
- Solicitud estructurada, contexto persistente al chat, propuesta visible, seguimiento/pending real.
- Protecci├│n SQL del `DIRECT_BOOKING` legacy y pruebas de seguridad.
**Gate:** E01ΓÇôE06, matriz perfiles, idempotencia; mantener experiencia anterior si feature flag OFF.

**Fase S2 ΓÇö solicitudes abiertas B:**
- Tablas/├¡ndices/RLS/read models `ServiceRequest`, wizard y tablero de oportunidades; ofertas aisladas, comparaci├│n y adjudicaci├│n at├│mica.
- Feature flag `PUBLIC_REQUESTS_ENABLED=false` hasta QA con tres oferentes; ON solo con autorizaci├│n del propietario.
**Gate:** E07ΓÇôE09, E22ΓÇôE23, carga/permisos/anti-spam. El flujo A no se altera.

**Fase S3 ΓÇö entrega verificada multimodal:**
- Eventos de entrega/evidencias; PIN solo para presencial, sin bypass ni doble validaci├│n enga├▒osa; entrega remota con archivos y revisi├│n.
- Correcci├│n/soporte, no respuesta, apelaci├│n y cron revisado; transici├│n/bloqueo coherente.
**Gate:** E10ΓÇôE16, E24/E26; pruebas de concurrencia y documentaci├│n de cron.

**Fase S4 ΓÇö declaraciones de pago externo:**
- Ledger independiente bilateral, adjuntos privados, declaraciones/confirmaciones/discrepancias, saldos y copy; soporte y reportes honestos.
- Preservar estado de pago MP desconectado y proteger contra cobro futuro doble.
**Gate:** E17ΓÇôE21 y E27; auditor├¡a permisos y c├ílculo ARS, sin transacciones reales.

**Fase S5 ΓÇö experiencia premium y endurecimiento:**
- QA completo accesibilidad/PWA/perf/analytics; pruebas de onboarding, notificaciones, cancelaciones, idioma y zona; terminar assets YALO.
- E2E de ambas rutas y ambas modalidades con cuentas autenticadas separadas; demo y evidencia en video/capturas.
**Gate:** E01ΓÇôE28 documentados PASS o excepci├│n justificada. No declarar ┬½premium┬╗ por build o commit.

**Validaci├│n sin GitHub Actions:** `pnpm --filter @changas/web typecheck`, `pnpm --filter @changas/web lint`, `pnpm test`, `pnpm --filter @changas/web build`, pgTAP contra DB de pruebas, inspecci├│n manual Android y revisi├│n de logs. Sin cambios de producci├│n autom├íticos. Leer `docs/CONTEXTO.md` por advertencia de 58 migraciones remotas que no est├ín en repo.

## Entregables y formato del reporte Muse por fase
- Estado **PASS / FAIL / NO VERIFICADO** de cada criterio, no solo narraci├│n;
- files changed, arquitectura/DDL propuestos, razones, mitigaciones y rollback;
- migraciones en repo y estado **real** aplicado/no aplicado por ambiente;
- evidencia de 2 sesiones, capturas Android (m├│vil light/dark), logs de tests;
- qu├⌐ se mantiene bajo flag y **qu├⌐ no se activ├│**;
- riesgos no resueltos y permiso necesario para siguiente lote.

---

# 18. DECISIONES SECUNDARIAS ABIERTAS (NO CAMBIAN D1ΓÇôD4)

1. **Categor├¡as de lanzamiento/zonas:** el motor debe ser gen├⌐rico; lanzar gradualmente para aprender, no imponer horarios urgentes gen├⌐ricos.
2. **Urgencias y SLA:** mostrar ┬½urgente┬╗ como preferencia hasta definir cobertura/tiempo prometido. Ning├║n timer estilo delivery sin operaci├│n para respaldarlo.
3. **Pol├¡tica de cancelaci├│n/no-show/revisiones:** sin multas autom├íticas en v1 hasta texto legal/pol├¡tica expl├¡cita; permitir contacto y soporte.
4. **Comisi├│n de YALO sobre pagos externos:** no crear deuda ni cobrar fuera de una definici├│n comercial/legal y consentimiento espec├¡fico.
5. **Anticipos:** desactivados en v1 por defecto, no confundir con pago al cierre; cambio futuro requiere nuevo spec.
6. **PIN presencial sin cliente disponible:** usar alternativa de evidencia/confirmaci├│n digital/soporte autorizada y registrar excepci├│n.
7. **Plazos sugeridos:** 7 d├¡as propuesta, 14 solicitud, 7 revisi├│n, 7 apelaci├│n son *defaults para discutir*, no SLA ni garant├¡a contractual; parametrizar si se decide.
8. **Identidad gr├ífica:** logos actuales trazados interinos en assets; obtener master vectorial fiel y validado para YALO, adem├ís de revisar uso legal del nombre.

**Nada de lo anterior autoriza a Muse a inventar comisiones, multas, garant├¡as, reembolsos, algoritmos de ranking opacos o integraciones financieras.**

# 19. CRITERIO GLOBAL DE ACEPTACI├ôN V1.0

YALO se considerar├í alineado con este SPEC cuando un cliente pueda **(a) reservar directamente con condiciones preautorizadas, (b) negociar con un prestador o (c) publicar una necesidad y elegir entre ofertas**, y el prestador pueda responder, contratar, coordinar, ejecutar, entregar y cerrar seg├║n modalidad; ambas partes puedan **declarar y confirmar** un pago externo sin ficci├│n de verificaci├│n; ninguno quede atrapado ante rechazo, cancelaci├│n, no-show o disputa; y todo se pueda reproducir en m├│vil accesible sin fuga de datos, dobles contratos ni confusi├│n de qui├⌐n debe hacer qu├⌐.

**FUENTE DE VERDAD:** decisiones D1ΓÇôD4 del usuario en la conversaci├│n del 14/10/2026. Los detalles que completan decisiones (plazos, estructuras nuevas, copies, agenda, tasas) se marcan como dise├▒o propuesto y deber├ín revisarse contra la implementaci├│n vigente. Las referencias Uber/PedidosYa/Rappi sustentan **patrones de UX**, no una supuesta identidad de procesos entre ellas y YALO.
