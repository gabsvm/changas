# Engineering Standard v1.1 — Desarrollo proporcional y cierre

**Alcance:** Codex, Claude Code, Muse Code y demás agentes que trabajen en este repositorio. **Objetivo:** entregar software útil, seguro y mantenible sin planificación excesiva, arquitectura prematura ni auditorías interminables. Complementa las instrucciones propias del proyecto; **no sustituye** requisitos explícitos del propietario, controles de seguridad ni normas regulatorias.

## 1. Prioridades generales

1. Valor para el usuario y reglas de negocio antes que sofisticación técnica.
2. La solución **más simple que satisfaga el requisito** y preserve las garantías necesarias; reutilizar convenciones y dependencias actuales.
3. Cambios acotados: sin funcionalidades, dependencias, abstracciones, refactors o herramientas fuera del alcance aprobado. Presentar aparte propuestas que lo amplíen.
4. La cantidad de código, documentación, bugs hipotéticos o tests **no** mide el éxito. Importan los comportamientos correctos y la entrega.
5. Expresar la evidencia y los límites: código inspeccionado, test aislado, prueba E2E, entorno de staging o producción son niveles distintos.
6. La falta de documentación no justifica inventar reglas de negocio. Tampoco convierte un arreglo urgente en un proyecto de documentación.

## 2. Descubrimiento y especificaciones: decidir ANTES de construir

### 2.1 Al empezar una tarea

- Identificar si el proyecto es **nuevo** o **existente**, y clasificar la tarea como **Rápida**, **Estándar** o **Crítica** (apartado 3).
- En tareas no triviales, revisar **primero** las fuentes relevantes: `docs/PRODUCT.md`, `docs/ROADMAP.md`, specs vigentes, ADR, README, instrucciones del proyecto y el código implicado. No asumir que una plantilla vacía o un documento antiguo son una especificación aprobada.
- Si el repositorio ya contiene una especificación equivalente con otro nombre, **usarla y conservarla**: no crear duplicados por cumplir una convención de nombres.
- Distinguir claramente: **confirmado por el propietario**, **observado en el producto/código**, **inferido** y **pendiente de decisión**.

### 2.2 Si NO existe Product Spec (`docs/PRODUCT.md` o equivalente)

**Proyecto nuevo o pedido de diseñar/construir un producto completo:** activar **MODO DESCUBRIMIENTO** antes de implementar funcionalidades. Inspeccionar lo ya disponible y conversar con el propietario para acordar una definición de producto suficientemente precisa. Crear un borrador usando la plantilla `PRODUCT.template.md` incluida en el kit (normalmente en `docs/templates/`). Primero aclarar **quién lo usa, qué problema resuelve, flujo principal, MVP/resultado esperado, reglas no negociables y fuera de alcance**. No iniciar implementación importante con preguntas críticas sin resolver.

**Proyecto existente y nueva funcionalidad sustancial:** reconstruir solo el contexto pertinente desde código/documentos, identificar lagunas que cambian el diseño, confirmar las decisiones críticas con el propietario y elaborar un **Feature Spec breve**. Ofrecer completar `PRODUCT.md` después, de forma incremental; no exigir una reconstrucción exhaustiva de todo el producto para avanzar en una funcionalidad delimitada.

**Bug puntual, cambio visual, incidente urgente, auditoría de solo lectura:** **NO BLOQUEAR** por falta de Product Spec. Resolver o investigar con el contexto disponible, respetando seguridad y alcance. Anotar brevemente la ausencia si limita una decisión. No redactar specs como efecto colateral salvo solicitud explícita.

### 2.3 Cómo preguntar sin agotar al propietario

- **Primero leer, después preguntar.** Nunca repetir preguntas contestadas en el pedido, el repositorio o decisiones previas accesibles.
- Hacer **3–5 preguntas de alto impacto por ronda** como máximo; menos cuando basten. Priorizar aquellas cuya respuesta cambie arquitectura, alcance, flujo o aceptación. Conversación natural, sin formularios extensos por defecto.
- Si hay suficientes datos, **proponer un borrador** y pedir corregir únicamente suposiciones materiales; no exigir responder veinte detalles antes de mostrar trabajo útil.
- Registrar incógnitas menores como `Pendiente / TBD` y continuar **solo en partes reversibles y seguras**. No decidir silenciosamente permisos, dinero, tratamiento de datos, borrados o requisitos legales.
- *Completo* significa **listo para decidir e implementar**, no documentar cada pantalla, tabla y excepción imaginable. Evitar specs que reproduzcan todo el código.
- Antes de construir un producto nuevo o implementar un alcance importante, resumir lo acordado y pedir confirmación del **alcance de producto** cuando faltó aprobación. No pedir permiso redundante para cada paso técnico ya autorizado.

### 2.4 Jerarquía de documentos y control del alcance

- `docs/PRODUCT.md` o equivalente: **qué y por qué** (producto, usuarios, reglas, límites).
- `docs/specs/<funcionalidad>.md`: **comportamiento concreto** para un cambio relevante (flujo, alcance, fuera de alcance, criterios verificables).
- `docs/ROADMAP.md`: **Now / Next / Later**; solo `Now` entra en el alcance actual salvo instrucción contraria.
- `docs/decisions/` (ADR, opcional): registrar decisiones difíciles de revertir, **no** decisiones rutinarias.
- `docs/RELEASE.md` (si aplica): verificación de despliegue, datos/configuración, observabilidad y rollback.
- Si hay conflicto entre documentos, código existente y pedido actual, **señalarlo**; no asumir que el código equivale a la intención del producto. Pedir decisión si afecta comportamiento de negocio o seguridad.
- Los specs aprobados son referencia de aceptación. Si se descubre un requisito indispensable nuevo, plantear una **enmienda de alcance**, no implementarlo subrepticiamente.

## 3. Tres modos proporcionales

| Modo | Ejemplos | Documentación | Validación |
|---|---|---|---|
| **Rápido** | Texto, estilo menor, bug localizado | Pedido y criterios simples; **sin spec nuevo** | Diff + prueba enfocada/manual pertinente |
| **Estándar** | Feature, múltiples pantallas, API + UI, cambio visible de negocio | Feature Spec breve; plan de pasos si ayuda | Tests de comportamiento y regresiones relacionadas |
| **Crítico** | Autorización, privacidad, dinero, migración riesgosa, operación irreversible | Spec con invariantes, riesgos, reversibilidad y ADR **solo si hay decisión duradera** | Tests positivos/negativos, permisos, integridad, plan de entrega y rollback |

El modo se determina por **impacto y reversibilidad**, no por líneas de código ni por entusiasmo del agente. Un bug pequeño de seguridad puede ser crítico. Un cambio muy grande puramente cosmético no exige la burocracia de un cambio monetario.

## 4. Requisitos de preparación y terminación

**Definition of Ready para cambios Estándar/Críticos:** propósito, usuario o actor, flujo feliz, comportamiento esperado, límites/fuera de alcance, criterios de aceptación comprobables y restricciones relevantes. Si falta una decisión que puede causar perjuicio irreversible, detener **esa decisión** y preguntar. Si el usuario ya especificó lo necesario, no crear etapas ceremoniales de aprobación.

**Definition of Done:** criterios satisfechos; diff acotado; checks relevantes aprobados o límites explicados; ningún P0/P1 conocido sin resolver o mitigación explícita; aspectos externos identificados (credenciales, contenido, pruebas manuales, despliegue) sin mezclarlos con bugs de código. **Merge, release y producción son aprobaciones distintas.**

Trabajar en incrementos pequeños y revisables. Si un cambio produce comportamiento nuevo aprobado, actualizar únicamente el spec pertinente. No editar un Product Spec en cada refactor.

## 5. Evidencia, severidad y triaje

**Tipo de observación:**
- **Confirmado:** falla demostrada por prueba/pasos verificables o por una propiedad determinista del código.
- **Riesgo fundamentado:** mecanismo plausible e impacto relevante; especificar hipótesis, límites y **validación mínima**.
- **Mejora opcional:** el producto funciona; la propuesta podría optimizarlo. **No rotularla como bug.**

**Prioridad (impacto × exposición/probabilidad × alternativas × reversibilidad):**
- **P0:** incidente activo grave, corrupción/pérdida crítica de datos, vulneración grave o servicio esencial totalmente indisponible. **Bloquea.**
- **P1:** flujo esencial inutilizable, violación seria de permisos/privacidad, error monetario importante o riesgo serio sustentado. **Bloquea release** salvo mitigación explícita apropiada.
- **P2:** defecto moderado, localizado o con alternativa. **No bloquea por defecto.**
- **P3:** optimización sin síntomas, aspecto cosmético, extremo improbable. Backlog o descartar.

No asignar P1 por un escenario simplemente imaginable. Seguridad e integridad pueden exigir mitigación preventiva aunque no se reproduzca una explotación; razonar superficie, impacto, evidencia y confianza. Evitar optimizaciones sin medición ni síntomas.

## 6. Implementar, probar y auditar

**Implementación:** inspeccionar patrones existentes; proponer la solución mínima; no crear nueva capa, patrón o dependencia solo para una tarea. Respetar archivos ajenos y cambios locales. No introducir requisitos fuera del spec vigente.

**Pruebas:** asegurar comportamientos de negocio y regresiones razonables; evitar tests redundantes, mocks que solo se prueban a sí mismos, snapshots gigantes y suites nuevas para detalles irrelevantes. A mayor criticidad, más pruebas de error, permisos y datos. CI verde no demuestra comportamiento en producción.

**Auditoría:**
1. Definir objetivo, SHA/versión, spec/criterios relevantes y superficie de riesgo.
2. En primera revisión de un hito: inspección proporcional, con prioridad en flujos esenciales y seguridad. En seguimiento: **revisar solo el delta, hallazgos pactados y regresiones cercanas**.
3. Separar defectos confirmados, riesgos fundamentados y sugerencias. Para cada ítem accionable: impacto para el usuario, evidencia, localización y cambio mínimo.
4. **No generar nuevas tareas** solo porque existen otras posibles mejoras. No convertir una corrección de P2 en una reauditoría integral.
5. Concluir **APROBAR / APROBAR CON OBSERVACIONES / BLOQUEAR**, diferenciando código/merge/release.

**Regla de cierre:** un hito → auditoría proporcional → corrección de bloqueadores → verificación dirigida → decisión. Nuevas auditorías integrales solo ante incidente, información nueva material, cambio arquitectónico, hito nuevo o pedido explícito. La regla no permite ignorar un nuevo P0/P1 real.

## 7. Seguridad, autorización y acciones externas

Nunca mutar producción, datos reales, permisos, credenciales, pagos, merges, despliegues o recursos irreversibles sin autorización expresa y alcance claro. Si una instrucción local parece entrar en conflicto con el pedido explícito o con un control de seguridad, señalarlo antes de proceder. Las reglas de dominio y compliance específicas del proyecto pueden exigir controles más estrictos que este estándar.

## 8. Entrega del agente

Respuesta concisa con: **(1) objetivo y alcance; (2) qué cambió y se verificó; (3) fallos bloqueantes vs observaciones; (4) decisión; (5) próximo paso mínimo**. Identificar decisiones pendientes, no inventar aprobaciones. Si el objetivo está cumplido, indicar **CERRAR** y no reabrir trabajo por iniciativa propia.

**Versión:** 1.1. Actualizar este estándar solo ante patrones de fallo repetidos. No convertir la lucha contra el overengineering en otro framework sobredimensionado.
