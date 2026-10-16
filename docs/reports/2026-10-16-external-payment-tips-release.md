# YALO — Desglose de propinas en pagos externos

**Preparado:** 2026-10-16 · **Estado:** para revisión, sin aplicación en Supabase.
**Rama:** `feat/external-payment-tips-20261016`
**Proyecto Supabase esperado:** `krjbpcnjhckqgwlqliyq`
**Proyecto Vercel:** `changas-web`, dominio `changas-web-gray.vercel.app`.

## Comportamiento acordado

- Un pago externo declarado por cliente o prestador puede superar el importe del contrato. Si es aceptado por la otra parte, se imputa primero al saldo contractual y todo excedente queda registrado como **propina**.
- Ejemplo: contrato ARS 100.000, efectivo informado ARS 120.000, prestador confirma: ARS 100.000 al precio acordado; ARS 20.000 de propina; saldo contractual ARS 0.
- También se permiten propinas adicionales una vez pagado completamente el contrato.
- Es un **registro bilateral de dinero intercambiado fuera de YALO**, no una transferencia de fondos, cobro electrónico, retención ni garantía bancaria.
- Al declarar, la UI muestra un desglose **estimado**; al confirmar, la RPC fija de forma atómica el desglose real. Una carrera entre pagos no puede imputar dos veces el mismo saldo contractual.
- Las propinas no cambian la versión de propuesta ni el precio contractual, tampoco forman parte de adicionales de alcance.

## Migración y seguridad

Migration append-only: `supabase/migrations/20261019000000_external_payment_tips.sql`.
Depende de `20261018080000_yalo_s4_bilateral_money.sql`; ejecutar **después** de que ésta exista en el proyecto.

- Agrega `external_payment_declarations.tip_amount_minor bigint not null default 0`, con CHECK entre cero y el importe de la declaración. Las confirmaciones históricas conservan propina = 0.
- `declare_external_payment` mantiene importe positivo, permisos por job, idempotencia, bloqueo y límite de 20 pendientes, pero ya no rechaza un importe por superar el precio.
- `respond_external_payment` conserva permisos solo para contraparte, trabajo COMPLETED, bloqueo asesor transaccional y una sola resolución. Al aceptar, calcula `precio_aplicado = LEAST(monto, GREATEST(acordado - confirmado_contractual, 0))`; `propina = monto - precio_aplicado`.
- `external_payment_ledger` mantiene la firma y columnas existentes por compatibilidad, pero `external_confirmed_minor` mide **solo precio confirmado**, excluyendo la propina; su historial por fila conserva el desglose confirmado.
- No toca Mercado Pago, flags de pagos online, RLS, instrumentos bancarios ni liquidaciones.

## Orden seguro del despliegue

1. **Aprobación explícita** para aplicar migración financiera en producción.
2. Verificar en Supabase que la migración S4 base está aplicada, tomar respaldo y ejecutar tests en una base aislada con migraciones equivalentes.
3. Aplicar `20261019000000_external_payment_tips.sql` vía migración Supabase, **antes** de publicar la nueva aplicación, ya que ésta lee el campo `tip_amount_minor`.
4. Confirmar columnas, funciones y permisos `authenticated`/RLS en la base migrada; verificar que no haya alteración de datos existentes.
5. Fusionar PR y verificar preview, compilación, TypeScript y deployment Vercel `READY` en `main`.
6. Probar con un trabajo de ensayo COMPLETED: precio exacto, efectivo superior, dos pagos parciales, propina sola, desacuerdo, anulación, repetición de la misma clave y prohibición de autoconfirmación.
7. Monitorear errores `/jobs/[jobId]` y discrepancias entre totales, confirmados contractuales y propinas.

**Si falla la migración:** no publicar la app; investigar el error y preservar la funcionalidad anterior.

**Si falla la app después de aplicar la migración:** conservar esquema y registros de propinas; preparar un hotfix hacia adelante. El rollback a una versión antigua puede ocultar el desglose de propinas en UI y ya no es preferible cuando existen nuevas propinas confirmadas.

## Evidencia de verificación

- `apps/web/src/lib/jobs/external-money.test.ts`: unit tests para cantidades iguales/superiores, parciales, propina-only, valores inválidos y estado pendiente.
- `apps/web/src/lib/jobs/external-money-tips-integration.test.ts`: regresiones de formularios, columnas leídas, permisos y asignación atómica.
- `supabase/tests/yalo-s4-money.sql`: 49 aserciones pgTAP (incluyen nuevos casos de propina y sumas contractuales). Este script hace ROLLBACK al terminar.
- **Limitación de acceso:** la conexión Supabase en la sesión devolvió `You do not have permission to perform this action` incluso para listar migraciones y consultar el job del error. No se ejecutó ni se puede afirmar que pasó el test de integración SQL sobre la base. No se realizaron mutaciones de dinero real.
