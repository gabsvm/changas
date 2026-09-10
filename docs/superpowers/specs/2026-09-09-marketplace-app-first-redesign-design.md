# Changas — Marketplace app-first redesign

## Estado

Dirección visual y alcance aprobados en conversación. Esta especificación describe la primera iteración del rediseño; no implementa cambios por sí misma.

## Objetivo

Hacer que Changas se perciba como un marketplace móvil de tareas y servicios, no como un dashboard. La experiencia principal debe llevar a una persona anónima desde una necesidad concreta hasta un servicio o proveedor público, con una interfaz cálida, energética y visualmente más rica que la actual.

El recorrido principal es:

`Home → búsqueda → resultados → detalle de servicio → perfil público → guardar o consultar`

## Dirección visual

La identidad usa la paleta existente como protagonista:

- Canvas: `#FFF9F3`
- Ink: `#202124`
- Orange: `#FF6B35`
- Yellow: `#FFC857`
- Functional blue: `#2563EB`
- Logo pink: `#FF0A78`
- Accessible strong pink: `#D60060`

### Composición

- El home abre con un hero degradado orange/yellow/pink.
- El contenido principal vive en una superficie crema redondeada que se superpone al hero.
- Las secciones usan capas cálidas: superficie, superficie elevada y sombra blanda.
- El color fuerte se concentra en hero, acciones y categorías; no se pinta cada componente.
- Las tarjetas tienen aire, jerarquía y sombras suaves; se evitan bordes repetitivos y bloques visualmente planos.
- Las categorías pueden usar ilustraciones simples y consistentes. No se inventan fotos, portfolios, reviews ni badges de proveedores.

### Tipografía y tono

- Titulares grandes, cortos y orientados a la acción.
- Copy argentino claro y conversacional: “¿Qué necesitás resolver?”, “Cerca tuyo”, “Explorar servicios”.
- Una acción primaria por pantalla.
- El producto debe sentirse cercano y activo, no infantil ni corporativo.

## Arquitectura de pantallas

### Home pública

1. Header liviano con logo, ubicación y entrada a cuenta.
2. Hero de marca con el mensaje “Tu mercado de tareas rápidas” o equivalente aprobado por contenido.
3. Buscador grande: “¿Qué ayuda necesitás?”.
4. Categorías destacadas con tiles ilustrados.
5. Carrusel horizontal de tareas/servicios cercanos cuando hay datos públicos.
6. Selector claro `Cerca mío / Remoto`.
7. CTA secundario para ofrecer servicios.
8. Navegación inferior mobile para usuarios autenticados; browsing anónimo no debe quedar bloqueado.

La ubicación es opcional. Si no está disponible, se muestran resultados remotos y descubrimiento general sin crear un estado de error dominante.

### Búsqueda y resultados

- Mantener la búsqueda visible en un header compacto.
- En mobile, filtros dentro de un bottom sheet accesible; en desktop, panel lateral persistente.
- Mostrar modalidad y ubicación como chips removibles.
- Mantener estado filtrado en la URL sin incluir estado privado.
- Lista como experiencia principal; el mapa queda secundario.
- Tarjeta de servicio con esta prioridad visual:

  `título del servicio → proveedor → zona/modalidad → precio → acción`

- Mostrar sólo datos reales disponibles.
- Estados de carga, vacío y error deben conservar el contexto de búsqueda y ofrecer una siguiente acción.

### Detalle de servicio

- Cabecera con categoría, título y precio.
- Proveedor visible con avatar, nombre y zona pública.
- Modalidad, precio y aceptación de ofertas destacados.
- Descripción breve y servicio ofrecido.
- CTA principal “Consultar”.
- CTA secundario “Ver perfil”.
- Guardado del proveedor como acción separada, con retorno seguro tras autenticación.

### Perfil público

- Identidad del proveedor en primer plano.
- Presentación corta y servicios publicados como catálogo.
- Zonas y modalidades disponibles.
- Portfolio únicamente cuando exista y sea público.
- No exponer campos privados ni claims no demostrables.

### Cuenta, mensajes y navegación autenticada

- Conservar la navegación inferior existente y aplicar el nuevo sistema visual.
- La cuenta se organiza por grupos de acciones, no como un panel administrativo.
- Mensajes prioriza conversaciones recientes, estados no leídos y contexto del servicio.
- Onboarding y seguridad mantienen flujos propios; comparten tokens, controles y estados visuales.
- El panel admin queda fuera de esta primera iteración visual.

## Componentes y límites técnicos

Reutilizar y extender los componentes existentes antes de crear nuevos:

- `AppHeader` / `MobileAppBar`
- `SearchField`
- `CategoryChip` y tiles de categoría
- `DiscoveryCard` / `ServiceCard`
- `SearchFiltersSheet`
- `AuthenticatedBottomNav`
- `Avatar`, `StatusChip`, `EmptyState`, `SectionHeader`

Los nuevos componentes sólo se justifican cuando representen una composición reusable del marketplace, como el hero de marca o el carrusel de tareas cercanas.

No se agregan dependencias de UI, mapas, animación ni realtime para resolver apariencia. Los tokens viven en el sistema CSS existente y deben conservar compatibilidad con el área administrativa.

Se mantienen sin cambios de contrato:

- rutas públicas y autenticadas existentes;
- RPCs y modelo de discovery;
- autenticación, favoritos y conversaciones;
- privacidad, RLS y Storage;
- renderizado server-first de páginas indexables.

## Interacción y accesibilidad

- Targets táctiles mínimos de 48 px.
- Labels semánticos para búsqueda, filtros y ubicación.
- Focus visible con blue funcional.
- No depender sólo del color para estados.
- Carruseles navegables con teclado y lectores de pantalla.
- Bottom sheets con foco controlado, cierre explícito y soporte de Escape.
- Mantener `prefers-reduced-motion`.
- Revisar contraste de texto blanco sólo sobre superficies suficientemente oscuras; usar `#D60060` para badges con texto blanco cuando corresponda.

## Responsive

### Mobile

- Viewports de referencia: 320, 360 y 390 px.
- Una columna, scroll horizontal sólo en rails intencionales.
- Hero compacto y panel crema superpuesto.
- Navegación inferior fija cuando el usuario está autenticado.
- Acciones primarias cercanas al pulgar.

### Desktop

- Contenedor de ancho limitado y márgenes amplios.
- Resultados en dos columnas cuando la densidad lo permita.
- Filtros laterales en búsqueda.
- Detalle con contenido principal y columna de acción sin convertirlo en dashboard.

## Datos y privacidad

- El diseño no agrega datos sintéticos al producto.
- No mostrar coordenadas exactas, direcciones privadas, email, teléfono privado, DNI, documentos, certificaciones privadas ni información administrativa.
- No mostrar ratings, trabajos completados, disponibilidad o verificación si no existen datos reales para sostenerlos.
- El contenido de metadata y OpenGraph usa sólo campos públicos.

## Plan de implementación

1. Ajustar tokens de profundidad, superficies, radios, sombras y tipografía.
2. Rehacer shell público y hero de home.
3. Reorganizar home alrededor de categorías, tareas cercanas y búsqueda.
4. Aplicar tarjetas y filtros a resultados.
5. Aplicar el lenguaje visual a detalle y perfil público.
6. Alinear cuenta, mensajes y navegación autenticada.
7. Revisar onboarding/provider con los mismos tokens, sin cambiar su lógica.
8. Ejecutar QA visual, responsive, accesibilidad y regresión funcional.

Cada paso debe mantener rutas y contratos existentes y producir un diff pequeño, revisable y reversible.

## Validación

- Contratos unitarios de tokens, componentes y estados vacíos.
- Tests de interacción para búsqueda, filtros, ubicación opcional, favoritos y retorno de autenticación.
- Playwright desktop y mobile para home, búsqueda, filtros, detalle, perfil y navegación autenticada.
- Revisión manual de 320/360/390 px y desktop.
- Verificación de overflow horizontal, focus visible y targets táctiles.
- Build, lint, typecheck, unit tests y format check de los archivos modificados.

## Fuera de alcance

- Nuevas migraciones, RPCs, RLS o Storage policies.
- Jobs, propuestas, pagos, reviews, reputación o notificaciones nuevas.
- Chat realtime.
- Mapa como experiencia primaria.
- Rediseño funcional del admin.
- Fotos generadas o datos ficticios de proveedores.

