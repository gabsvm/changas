# Muse Code — instrucciones de arranque para SPEC YALO v1.0

**Lee completo antes de tocar código**:
- [SPEC funcional YALO v1.0](./YALO_MARKETPLACE_END_TO_END_SPEC_V1_2026-10-14.md)
- [Auditoría + handoff anterior](../audits/2026-10-14-YALO-MUSE-HANDOFF.md)
- [Identidad YALO](../brand/yalo/YALO_BRAND_SYSTEM.md)
- `docs/CONTEXTO.md` (especialmente la divergencia histórica de migraciones Supabase).

## Requerimientos aprobados por el usuario
1. Dos canales de contratación: elegir prestador + publicar solicitud abierta a múltiples oferentes.
2. Contratación directa solo para servicios de precio/condiciones/capacidad preautorizados; negociación cuando no.
3. Entrega presencial mediante verificación PIN + confirmación del cliente; remota con evidencia y confirmación digital.
4. Pagos entre cliente y prestador por fuera de YALO, con declaraciones y conciliación bilateral; NO hay pagos online activos.

## Orden de trabajo obligatorio
**No implementar todo el SPEC en una sola ejecución.** Comenzar SOLO con la fase **S0** del SPEC: corregir copy engañoso de pagos, pestaña «Todos» de trabajos, CTA del paso 4 de onboarding, revisión visual final/PWA y residuos de marca. Crear rama desde main actual, PR para revisar y evidencia tests. Después PARAR y esperar autorización del siguiente lote.

Los lotes S1/S2/S3/S4/S5 requieren nuevas autorizaciones antes de cambiar reglas de producción o base de datos. No habilitar `PAYMENTS_ENABLED` ni `payments_online`, no implementar checkout MP, no confiar en GitHub Actions como gate, no ejecutar `supabase db push` sobre producción, no modificar main ni Vercel por accidente.

## Lo que debe entregar por lote
- Comparación del estado real del repo con el SPEC y plan corto antes de editar;
- Tabla de archivos/cambios, tests y pruebas manuales cliente/prestador con PASS/FAIL;
- Evidencia visual en móvil 360/390/412 y desktop light/dark;
- Migraciones propuestas append-only, estado REAL de aplicación (ninguna sin permiso);
- Casos de seguridad/RLS/RPC e idempotencia para las fases correspondientes;
- Lista de puntos aún no implementados e instrucciones claras para próximo lote.

No dar por implementados el tablón público ni el ledger externo por existir en el SPEC: son funciones NUEVAS. No mostrar dinero pagado como «verificado por YALO»; solo «declarado»/«confirmado por ambas partes».

**Primera tarea concreta:** auditar S0 contra `main` actual, corregir esos puntos, ejecutar typecheck, lint, unit tests y build local, comprobar banderas OFF, entregar PR para revisión, detenerse.
