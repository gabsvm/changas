# PRODUCT — Changas

> **Estado:** Borrador (reconstruido desde código; NO confirmado por propietario)
> **Última revisión:** 2026-10-13
> **Fuentes consultadas:** `docs/CONTEXTO.md` (2026-10-11), `README.md`, `apps/web` (Next.js 16, PWA), `packages/domain` + `packages/validation`, `docs/design/changas-brand-system.md`, `CHANGAS_MASTER_PLAN.md` (visión V1, parcialmente superseded según README). Lo no observado se marca `[INFERENCE]` o TBD.

> **Regla de uso:** este archivo describe el PRODUCTO, no la implementación. Decisiones no confirmadas van en §8.

## 1. Visión y problema

- **Qué es:** marketplace PWA mobile-first de oficios y habilidades (es-AR), donde la misma cuenta opera como cliente y como proveedor.
- **Problema principal que resuelve:** contratar un oficio con confianza sin pago por adelantado: descubrir, consultar por chat, acordar propuesta, hacer seguimiento con código de confirmación y pagar al finalizar.
- **Por qué existe / qué valor genera:** reduce el riesgo de contratar (reputación verificada, tracking del trabajo, cobro al cierre por Mercado Pago) y da al proveedor una vidriera con gestión de servicios incluida.

## 2. Usuarios y permisos relevantes

| Actor | Necesita lograr | Restricciones de acceso conocidas |
|---|---|---|
| Visitante | descubrir servicios, ver perfil público y precio | solo lectura pública (`/`, `/buscar`, `/p/[slug]`) |
| Cliente (logueado) | consultar por chat, aceptar propuesta (= contratar), seguir el job, confirmar finalización, pagar al cierre, reseñar | solo sus conversaciones/jobs; confirmar finalización genera obligación de pago |
| Proveedor (misma cuenta) | publicar servicios, responder chat, enviar propuesta, ejecutar job, ingresar código de 4 dígitos | onboarding con identidad privada (5 datos) + revisión; sus servicios en borrador hasta publicar |
| Admin | catálogo, identidad, proveedores, usuarios | tablas internas sin RLS pública; borrado de cuenta exige contraseña + escribir ELIMINAR |

## 3. Flujos esenciales

1. **Descubrir → consultar → propuesta → contratar:** buscar/categoría → perfil/servicio → chat → propuesta con precio y fechas → aceptar = job `CONFIRMED` (hire-on-accept, sin pago).
2. **Ejecutar → confirmar → pagar al cierre:** tracking del job → código de confirmación de 4 dígitos → confirmación (posible auto-confirmación a 7 días) → checkout Mercado Pago (`createJobSettlementCheckout`) → reseña y rehire.
3. **Proveedor:** onboarding → crear servicio → recibir consulta → proponer → ejecutar → cobrar al cierre.
4. **Soporte:** notificaciones y push web (VAPID) avisan respuestas y cambios de estado; email deshabilitado a propósito ("todavía no disponibles").

## 4. MVP y criterios de éxito

- **Es parte del MVP:** descubrimiento público, perfiles/servicios públicos, chat + propuestas, hire-on-accept, tracking con código, pago al cierre por MP, reseñas, PWA instalable con offline básico, dark manual Claro/Oscuro/Sistema (default Claro).
- **No es parte del MVP / fuera de alcance:** email (muerto a propósito, falta `RESEND_*`), retención de fondos o escrow (NO existe: nunca prometerlo), pago upfront.
- **Se considera usable cuando:** un visitante contrata desde el móvil sin registrarse hasta el chat; el cliente paga al cierre sin salir del flujo; el proveedor publica y cobra; la app instalada abre offline con mensaje honesto.

## 5. Reglas de negocio e invariantes

- Aceptar propuesta = contratar; el job nace `CONFIRMED` sin movimiento de dinero.
- **Sin pago por adelantado y sin retención de fondos.** Nunca mostrar copy de "pagos retenidos", "liberación" ni "comisión descontada antes de liberar" (bugs P1 corregidos 2026-10-13).
- El "Total a pagar" solo existe para precio `FIXED`; para `STARTING_AT`/`HOURLY`/`PER_UNIT`/`QUOTE` el precio es referencia y el total se acuerda en la propuesta.
- Confirmar finalización genera la obligación de pago: exige interstitial con monto visible (hoy 1 tap — P2 abierto).
- Producción: `https://changas-web-gray.vercel.app`; Supabase `krjbpcnjhckqgwlqliyq`. Nunca `supabase db push` (remoto diverge: 58 migraciones fuera del repo).

## 6. Contexto y dependencias (solo decisiones relevantes)

- **Canales/plataformas:** PWA responsive mobile-first (iOS + Android), instalable, con service worker de alcance `/`.
- **Servicios externos o integraciones aprobadas:** Supabase (auth Postgres + RLS), Mercado Pago checkout, push web VAPID.
- **Limitaciones técnicas o presupuestarias:** sin Docker local (pgTAP solo en CI); email sin proveedor configurado.

## 7. Límites y riesgos de lanzamiento

- **Condiciones externas no cubiertas por CI:** webhook MP (tiempos reales), entrega push real, GPS en device, contraste/dark en pantalla, `PAYMENTS_ENABLED` en prod (P1-02 ya registrado en CONTEXTO).
- **Riesgos aceptados explícitamente:** código de confirmación de 4 dígitos sin throttle (P1-07 registrado); CI rojo P1-01 (registrado).

## 8. Decisiones por resolver

| Pregunta pendiente | Por qué importa | Estado / responsable |
|---|---|---|
| CTA primario: ¿naranja + texto tinta (brand doc) o tinta + blanco (código actual)? Contradicción real entre `docs/design/changas-brand-system.md` y `globals.css` | cambia el sistema visual completo | Pendiente / propietario |
| Geografía y alcance de lanzamiento | define filtros "cerca", zonas y rollout | Pendiente / propietario |
| ¿Existe métrica de tiempo de respuesta del proveedor? (el sticky dice "responde rápido" sin dato) | copy con o sin evidencia | Pendiente / propietario |
| Reprogramar en `IN_PROGRESS`: ¿regla de negocio o faltante? | cambia spec de lifecycle | Pendiente / propietario |

## 9. Historial mínimo

- 2026-10-11: estado vivo en `docs/CONTEXTO.md` (hire-on-accept, cobro al cierre, push real, dark manual).
- 2026-10-13: PRODUCT reconstruido como Borrador + corrección P1 (copy escrow, total no-fijo, botón dark) — pendiente confirmación del propietario.
