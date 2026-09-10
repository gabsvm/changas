# Changas Marketplace Polish Design

## Objetivo

Elevar la experiencia mobile-first de Changas manteniendo la paleta actual, con una jerarquía visual premium, ubicación explícita y una ruta de avatar funcional sin relajar la privacidad de Supabase Storage.

## Dirección visual aprobada

- El hero de Inicio será la pieza focal: gradiente de marca, profundidad mediante sombra/borde tonal y un panel de búsqueda elevado.
- La búsqueda mantendrá una sola acción primaria clara; ubicación, modalidad y categorías funcionarán como contexto compacto.
- Mensajes, Actividad, Cuenta y onboarding usarán el mismo lenguaje de cards, filas accionables, chevrons, iconos, estados pressed/focus y empty states.
- Los controles secundarios se presentarán como paneles inferiores en mobile y superficies compactas en desktop.
- Se conserva la paleta existente: canvas crema, ink oscuro, naranja, amarillo, azul funcional y rosa de marca.

## Ubicación

- El usuario activa geolocation sólo con una acción explícita.
- Se mantienen zonas manuales y servicios remotos cuando el permiso no existe o es rechazado.
- Las coordenadas exactas se mantienen efímeras en el cliente/request y no se escriben en URL, perfil ni payload público.

## Storage

- `profile-avatars` permanece privado.
- La migración existente `20260909024000_profile_avatars.sql` es la fuente de verdad; la reparación de producción consiste en aplicar migraciones pendientes, no en abrir el bucket.
- La UI traduce `Bucket not found` a una instrucción accionable sin ocultar el diagnóstico server-side.

## Fuera de alcance

- No se agregan dependencias visuales, mapas, IA, cambios de RLS, RPCs, pagos ni nuevas tablas.
