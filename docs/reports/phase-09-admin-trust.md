# Phase 09 — Admin Console & Trust & Safety

## Estado final

**Fase:** Phase 09 — Admin Console & Trust & Safety  
**Rama activa reconciliada:** `codex/phase-09-admin-trust-reconciled`  
**Rama histórica preservada:** `codex/phase-09-admin-trust` en `8df3d21681bce42ee642439689ea5090e1a87242`  
**Base aprobada (Phase 08):** `133dfd58a078916ad123fdc84cd08d87ef20d141`  
**Checkpoint histórico Admin Core/RBAC:** `2bfcb77df440da59da1711bed8f3b081eb43ff42` — CI `33656903776` GREEN  
**Implementation HEAD funcional verificado:** `c88892887b49a33e5fd9c4a2370e37f64736923a` — CI `33837374708` GREEN

Phase 09 queda implementada contra el alcance y los criterios de aceptación de `CHANGAS_MASTER_PLAN.md` y `docs/superpowers/plans/2026-09-02-phase-09-admin-trust.md`.

La fase fue reconciliada sobre el Final HEAD aprobado de Phase 08 después de detectar que la rama histórica de Phase 09 había sido creada prematuramente desde un Phase 08 incompleto. El trabajo válido de Admin Core/RBAC fue preservado, el RED histórico de identity review fue retomado y completado, y la rama histórica no fue mutada.

La aprobación formal exige que el commit que contiene este reporte complete su pipeline CI completamente GREEN. El SHA y el CI exactos de ese cierre se registran en la respuesta final de aprobación para evitar una auto-referencia imposible dentro del propio commit.

---

## 1. Alcance implementado

1. **Rol administrativo real y RBAC server-authoritative**
   - El rol `admin` vive en autoridad de servidor.
   - La superficie administrativa valida sesión y rol antes de exponer datos o ejecutar acciones.
   - Un usuario autenticado normal recibe una superficie no disponible y no puede invocar los RPCs administrativos con éxito.

2. **Panel `/admin` separado**
   - Layout administrativo propio.
   - Navegación hacia usuarios, prestadores, identidad, catálogo, trabajos, reportes y auditoría.
   - La UI no usa flags de cliente como autoridad de permisos.

3. **Usuarios**
   - Listado administrativo paginado/buscable.
   - Detalle con datos privados únicamente para administradores.
   - Acciones de restricción, suspensión y restauración auditadas.

4. **Prestadores**
   - Listado y detalle administrativo.
   - Estado de onboarding/verificación, marketplace, disponibilidad y servicios.
   - Acceso a información privada separado de las superficies públicas.

5. **Revisión de identidad**
   - Cola y detalle de casos `IDENTITY_PENDING`.
   - Evidencia privada accesible por URL firmada sólo desde flujo admin.
   - Aprobación/rechazo server-authoritative.
   - Toda decisión deja evento de auditoría.

6. **CRUD de categorías**
   - Crear, editar, activar/desactivar y eliminar cuando las dependencias lo permiten.
   - Mutaciones mediante RPCs administrativas auditadas.

7. **CRUD de skills**
   - Crear, editar, mover de categoría, activar/desactivar y eliminar cuando no tiene dependencias incompatibles.
   - Mutaciones mediante RPCs administrativas auditadas.

8. **CRUD de sinónimos**
   - Crear, listar, editar y eliminar sinónimos desde `/admin/catalog`.
   - Normalización de búsqueda preservada.
   - Operaciones de escritura auditadas.

9. **CRUD de tags de servicios**
   - Crear, listar, editar y eliminar tags desde `/admin/catalog`.
   - El tag normalizado continúa siendo la clave de búsqueda/control de duplicados.
   - Creación, actualización y eliminación producen `CATALOG_TAG_CREATED`, `CATALOG_TAG_UPDATED` y `CATALOG_TAG_DELETED`.

10. **Moderación de servicios**
    - Estados `CLEAR`, `FLAGGED` y `DISABLED`.
    - Deshabilitar pausa el servicio mediante autoridad de base de datos.
    - Restaurar recupera el estado de pausa anterior del prestador.
    - Un prestador no puede puentear una deshabilitación administrativa mediante una actualización directa normal.

11. **Trabajos**
    - Vista administrativa de Jobs con participantes, servicio, estado y timestamps relevantes.

12. **Cola unificada de reportes**
    - Reportes de conversaciones y reviews se leen desde una cola administrativa coherente.
    - Resolución de caso registra actor, resolución y auditoría.

13. **Restricciones y suspensiones reversibles**
    - Restricciones activas son server-authoritative.
    - Se evita más de una restricción activa simultánea por cuenta.
    - Restauración revoca la restricción sin destruir evidencia histórica.
    - Límites transaccionales bloquean acciones incompatibles de cuentas restringidas.

14. **Moderación reversible de reviews**
    - `VISIBLE`, `HIDDEN_POLICY` y `RESTORED`.
    - El texto publicado original permanece inmutable.
    - Reviews ocultas dejan de afectar las lecturas públicas y métricas de reputación.
    - Restauración no reconstruye ni altera artificialmente el contenido original.

15. **Moderación reversible de mensajes preservando evidencia**
    - El contenido original no se destruye para moderarlo.
    - La visibilidad se controla mediante estado de moderación separado.
    - La evidencia histórica permanece disponible al flujo administrativo autorizado.

16. **Auditoría administrativa completa**
    - Identidad, catálogo, moderación, reportes, restricciones, restauraciones y taxonomy CRUD generan eventos con actor, acción, target, metadata y timestamp.
    - `/admin/audit` expone el historial sólo al rol administrativo.

17. **Tablas administrativas acotadas/paginadas**
    - RPCs de usuarios, prestadores, servicios, jobs, reportes y auditoría usan límites explícitos.
    - Las superficies de catálogo/taxonomía están controladas por el volumen acotado del catálogo V1 y por RPCs admin-only.
    - Los read models operativos de catálogo y servicios exigen `require_admin()` y validan los límites de paginación del listado de servicios.

18. **E2E administrativo**
    - Usuario normal no accede a `/admin`.
    - Admin revisa evidencia de identidad, aprueba el caso y verifica auditoría.
    - Admin resuelve reporte, deshabilita y restaura un servicio sintético aislado.
    - Admin ejecuta CRUD de sinónimos y tags desde el panel y verifica eventos de auditoría de tags.

---

## 2. Migraciones principales

- `supabase/migrations/20260902170000_phase_09_admin_core.sql`
  - RBAC admin;
  - read models/RPCs administrativos;
  - auditoría base.
- `supabase/migrations/20260902171000_phase_09_identity_review.sql`
  - lectura privada y decisión de identidad;
  - flujo de aprobación/rechazo auditado.
- `supabase/migrations/20260902172000_phase_09_catalog_moderation.sql`
  - CRUD administrativo de categorías, skills y sinónimos;
  - moderación reversible de servicios y guard de pausa.
- `supabase/migrations/20260902173000_phase_09_trust_safety.sql`
  - cola de reportes;
  - restricciones/suspensiones;
  - moderación de reviews y mensajes;
  - guards transaccionales y filtrado de reputación pública.
- `supabase/migrations/20260902173500_phase_09_catalog_taxonomy_admin.sql`
  - lectura admin de sinónimos/tags;
  - CRUD administrativo de service tags;
  - grants restringidos y auditoría de tags.
- `supabase/migrations/20260902174000_phase_09_trust_safety_runtime_fix.sql`
  - elimina la ambigüedad PL/pgSQL entre parámetros de los RPCs y `account_restrictions.target_user_id`;
  - preserva la API publicada de restricción/restauración y sus eventos de auditoría;
  - mantiene restauración reversible del estado previo del prestador.
- `supabase/migrations/20260902174500_phase_09_catalog_read_models.sql`
  - agrega read models operativos para categorías, skills y servicios del catálogo admin;
  - exige `require_admin()` en cada entrypoint;
  - valida paginación del listado de servicios y mantiene ejecución fuera de `anon`/`public`.

---

## 3. Superficies administrativas

Principales rutas y piezas incorporadas o extendidas:

- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/providers/page.tsx`
- `apps/web/src/app/admin/identity/page.tsx`
- `apps/web/src/app/admin/catalog/page.tsx`
- `apps/web/src/app/admin/jobs/page.tsx`
- `apps/web/src/app/admin/reports/page.tsx`
- `apps/web/src/app/admin/audit/page.tsx`
- `apps/web/src/app/admin/actions.ts`
- `apps/web/src/lib/admin/server.ts`
- `apps/web/src/lib/admin/identity.ts`
- `apps/web/src/lib/admin/policy.ts`
- `apps/web/src/app/api/admin/identity-documents/[documentId]/route.ts`

El panel consume RPCs server-side y mantiene las operaciones sensibles fuera de las superficies públicas del marketplace.

---

## 4. Seguridad y aislamiento de datos

- Las tablas de estado administrativo/Trust & Safety mantienen RLS activa.
- Roles de navegador no reciben DML directo sobre estado de moderación, restricciones o auditoría.
- RPCs administrativas requieren usuario autenticado y validan el rol real con `require_admin()`.
- `anon` no obtiene ejecución sobre entrypoints administrativos.
- Evidencia de identidad permanece en storage privado y se entrega mediante URLs firmadas temporales al flujo autorizado.
- El panel no reutiliza endpoints públicos para leer PII administrativa.
- Reviews ocultas se filtran de reputación y lecturas públicas sin mutar el texto original.
- Mensajes moderados preservan evidencia en lugar de destruirla.
- Restricciones y deshabilitación de servicios tienen guards de base de datos para impedir bypass desde clientes normales.
- Los read models de catálogo agregados para el cierre se mantienen admin-guarded y no abren acceso anónimo.

---

## 5. Pruebas Phase 09

### pgTAP

- `supabase/tests/phase-09-admin-rbac.sql`
- `supabase/tests/phase-09-identity-review.sql`
- `supabase/tests/phase-09-catalog-moderation.sql`
- `supabase/tests/phase-09-trust-safety.sql`
- `supabase/tests/phase-09-catalog-taxonomy-admin.sql`
- `supabase/tests/phase-09-catalog-read-models.sql`

El contrato de Trust & Safety contiene 24 assertions; el contador pgTAP fue corregido a `plan(24)` después de comprobar que las 24 assertions funcionales pasaban.

La verificación funcional de cierre en `c88892887b49a33e5fd9c4a2370e37f64736923a`, CI `33837374708`, ejecutó **33 archivos / 492 assertions pgTAP**, con `Result: PASS`.

### Runtime

- `apps/web/scripts/phase-09-admin-runtime.mjs`
- `apps/web/scripts/phase-09-trust-safety-runtime.mjs`

En CI `33837374708` ambos runtimes finalizaron `PASS`. El runtime de Admin confirmó RBAC, aislamiento de auditoría, identity review, catalog CRUD y moderación reversible de servicios bajo autoridad de servidor; Trust & Safety también completó sus checks sin fallos.

### Browser E2E

- `tests/e2e/phase-09-admin-trust.spec.ts`

Los journeys cubren denegación a usuario normal, revisión de identidad, resolución de reportes, moderación reversible de servicio y CRUD operativo de sinónimos/tags.

Durante el cierre se eliminó contaminación entre proyectos E2E: el journey de moderación dejó de reutilizar estado demo compartido y pasó a crear un fixture dedicado. El último fallo residual se reprodujo aisladamente como PostgreSQL `23503` sobre `services_provider_skill_fk`; el fixture creaba `provider_profiles` y `services` pero omitía la relación obligatoria en `provider_skills`. El fixture final respeta explícitamente `provider_profiles → provider_skills → services` antes de ejecutar la moderación.

CI `33837374708` verificó el resultado completo en Chromium y `mobile-web`: **52/52 tests Playwright PASS**. El caso de reporte + deshabilitación/restauración del servicio aislado pasó en ambos proyectos.

### Build, formato y performance

En el mismo CI funcional de cierre:

- lint: PASS;
- typecheck: PASS;
- unit tests: PASS;
- production build: PASS;
- Prettier/format check: PASS;
- `git diff --check`: PASS;
- Lighthouse mobile home: **72**;
- Lighthouse mobile `/buscar`: **76**.

---

## 6. Reconciliación de historial

La rama histórica `codex/phase-09-admin-trust` queda preservada en `8df3d21681bce42ee642439689ea5090e1a87242` como evidencia del desarrollo original.

La rama activa parte de Phase 08 aprobada en `133dfd58a078916ad123fdc84cd08d87ef20d141`. El checkpoint histórico Admin Core/RBAC `2bfcb77df440da59da1711bed8f3b081eb43ff42` fue preservado conceptualmente durante la reconciliación y Phase 09 continuó desde el identity-review RED que había quedado abierto.

No se incorporó trabajo de Phase 10 durante esta recuperación/cierre.

---

## 7. Criterios de salida

- [x] Rol admin real y validación server-side.
- [x] Usuario normal sin acceso a panel ni datos admin.
- [x] Usuarios y prestadores administrables.
- [x] Identidad revisable de forma privada y auditable.
- [x] Categorías CRUD.
- [x] Skills CRUD.
- [x] Sinónimos CRUD.
- [x] Tags CRUD.
- [x] Servicios moderables de forma reversible.
- [x] Jobs visibles para soporte/admin.
- [x] Cola de reportes y resolución.
- [x] Restricciones/suspensiones y restauración.
- [x] Moderación reversible de reviews.
- [x] Moderación reversible de mensajes preservando evidencia.
- [x] Auditoría de acciones sensibles.
- [x] Límites/paginación en read models administrativos de alto volumen.
- [x] E2E administrativo aislado y reproducible.
- [x] CI funcional de implementación completamente GREEN antes del reporte final.
- [x] Phase 10 no iniciada.

**Estado de implementación:** `PASS`.  
**Estado formal de la fase:** `CLOSED / APPROVED` cuando el CI asociado al commit que contiene este reporte finalice completamente GREEN.
