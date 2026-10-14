# YALO — Brand System v1 · especificación para Muse Code

> **Estado:** guía aprobada de dirección visual, NO implementación ni vector final validado.
> **Marca elegida por el dueño del producto:** **YALO**.
> **Referencia:** columna izquierda de la imagen proporcionada en la conversación del 14/10/2026, identificada por el logo **YALO**. Las columnas **tuki** y **Extra** son alternativas NO seleccionadas y NO deben mezclarse.
> **Base técnica auditada:** `gabsvm/changas` en `4cffce41d535ba307578b6f90a1f97e1a43538a0`.
> **Documento operativo:** [Handoff unificado para Muse](../../audits/2026-10-14-YALO-MUSE-HANDOFF.md).

## 1. Qué representa YALO

YALO es el marketplace donde una persona encuentra quien resuelva una necesidad y otra ofrece lo que sabe hacer. Se conserva la propuesta y el comportamiento del producto actual: mismas cuentas, oferta, servicios, conversaciones, propuestas, contratación, seguimiento y reputación. **Rebrand ≠ reconstrucción de lógica de negocio.**

**Naming público:** YALO (siempre mayúsculas cuando es firma/logo; «Yalo» puede usarse solo en texto conversacional si tiene sentido editorial). **Lema de la referencia:** «TRABAJÁ · CONTRATÁ · CRECÉ»; conservar esas tres palabras, acentos y separación como firma secundaria, no repetir el lema en todas las pantallas. Voz: argentina, clara, humana, competente, sin promesas no demostrables («respuesta inmediata», «pago garantizado»). Evitar autodenominarse red social.

### Rasgos observables de la referencia

- Isotipo humano abstracto **en forma de Y**, como persona celebrando/uniendo brazos: brazo izquierdo azul-cian, cuerpo turquesa, brazo derecho verde menta; extremos gruesos y redondeados; **cabeza circular separada** en la parte central superior.
- Wordmark `YALO` en **blanco**, geométrico, muy ancho, peso alto, centrado bajo el isotipo sobre **navy casi negro**. El lettering parece personalizado y NO debe reconstruirse con una tipografía de texto genérica y darse por exacto.
- Lockup horizontal sobre blanco: isotipo a la izquierda, letras navy a la derecha y lema pequeño debajo. Aplicación en cuadrados oscuros, blancos y gradiente azul/turquesa; uso en ícono de móvil.
- La referencia es una **captura comprimida**, no archivos maestros vectoriales: no puede garantizarse proporción, kerning, curvas ni hexadecimal exacto. Extraer/recrear el vector definitivo con trazado cuidadoso y revisión visual con la referencia original. Verificar que el original pertenezca/licencie a quien realizará el lanzamiento.

## 2. Paleta operativa candidata

Los valores son **aproximaciones inferidas de píxeles de la captura**, no normas oficiales del diseñador. Muse debe ajustarlos visualmente con la referencia y validar contraste en ambas modalidades.

| Token semántico | Valor inicial | Uso |
|---|---|---|
| `yalo.navy.950` | `#0D121B` | Superficie de marca, iconos oscuros, portada e ícono app |
| `yalo.navy.900` | `#161D2A` | Panel oscuro y encabezado corporativo |
| `yalo.navy.800` | `#1E293B` | Bordes/diferenciación en paneles navy |
| `yalo.cyan.500` | `#08A9F4` | Ala izquierda del símbolo, acento azul |
| `yalo.teal.500` | `#12D9C5` | Centro del símbolo, progreso decorativo |
| `yalo.mint.400` | `#65EC91` | Ala derecha, éxito de marca cuando aplique |
| `yalo.canvas.light` | `#F6F9FC` | Fondo claro neutral frío |
| `yalo.surface.light` | `#FFFFFF` | Tarjetas/forms en claro |
| `yalo.ink.light` | `#101827` | Texto principal en tema claro |
| `yalo.muted.light` | `#526174` | Texto secundario en claro |
| `yalo.border.light` | `#DCE5EE` | Bordes de control |
| `yalo.canvas.dark` | `#0D121B` | Fondo oscuro |
| `yalo.surface.dark` | `#171F2C` | Tarjetas/forms en oscuro |
| `yalo.ink.dark` | `#F5F8FC` | Texto principal oscuro |
| `yalo.focus` | `#1576D2` | Anillo de foco accesible, revisar en dark |
| `yalo.danger` | `#C83D46` | Errores; no sustituir semántica por mint |

**Gradiente identitario:** `linear-gradient(115deg, #08A9F4 0%, #12D9C5 52%, #65EC91 100%)`. Reservarlo para isotipo, pequeños acentos, algunos estados activos y momentos de marca; **no tapizar tarjetas, headers, formularios ni pantallas de gradiente**. Las funciones «destructive», «warning», «info» y «success» conservan colores semánticos validados, no se vuelven todas verde/azul por marketing.

**Contraste:** sobre fondos claros, CTAs prioritarios navy con texto blanco; alternativa azul SOLO si ratio de contraste comprobado para su texto. Sobre fondos navy, CTAs claros o cian intenso con tinta oscura contrastada. **No utilizar mint/cyan claro como texto pequeño sobre blanco**. Referencia WCAG 2.2 AA (4.5:1 texto normal, 3:1 grande y componentes gráficos relevantes). Verificar matemáticamente en tema light y dark; no asumir.

## 3. Variantes oficiales a producir

1. `yalo-logo-primary-dark.svg`: lockup vertical navy, Y multicolor, lettering YALO blanco, lema opcional separado.
2. `yalo-logo-horizontal-light.svg`: símbolo + wordmark navy sobre fondo transparente/blanco.
3. `yalo-symbol.svg`: solo Y antropomórfica; SVG limpio, sin fondos ni padding baked-in.
4. `yalo-symbol-monochrome.svg`: blanco/navy monocromático para tamaños pequeños y casos de accesibilidad.
5. `yalo-icon-master.svg` + `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, apple touch, favicon: fondo navy, símbolo centrado, **safe zone generosa** y prueba de recorte Android adaptativo/círculo.
6. OG/social `1200×630`, splash/install PWA y screenshots de store **regeneradas de la interfaz YALO real**.

**Archivo conceptual del repo:** [yalo-isotipo-boceto.svg](./yalo-isotipo-boceto.svg) muestra la silueta y la combinación cromática, pero **NO es el logotipo maestro ni debe desplegarse como reemplazo final**. El lettering final debe reproducir la referencia, no el boceto ni un `<text>` SVG genérico.

### Principios de composición

- Centro de masa en el símbolo; círculos/puntas grandes y redondeados; nunca contornos finos, degradados metálicos, biseles, brillo excesivo o ruido.
- En 24–32 px se debe entender la Y y la cabeza; si se pierde, simplificar **sin deformar** el isotipo.
- Wordmark geométrico, claro, alto contraste; sobre fondo blanco usar navy, sobre navy usar blanco; no poner texto encima del gradiente.
- Área de seguridad: mínimo 0.15× del ancho del símbolo por lado, ajustar al master; tamaño mínimo de lockup testado en Android.
- No introducir los amarillos, violetas, rosa o el lettering de las propuestas `tuki`/`Extra`.

## 4. Tipografía y sistema UI premium

Mantener inicialmente **Inter** en cuerpo y **Space Grotesk** en títulos si sus renders funcionan: ya están integradas en `app/layout.tsx`. No gastar un sprint cambiando fuentes de interfaz por gusto: el **wordmark YALO es un asset separado**. Escalas móviles: texto base 16px, ayudas >=12–13px con contraste, heading moderado, 44–48px mínimo táctil, foco visible; respetar `prefers-reduced-motion`.

Diseño comparable por *calidad de interacción* a Facebook/Instagram/X, pero propio para marketplace: tarjetas simples, separación consistente, una CTA dominante por etapa, chips solo si agregan datos, mensajes que se sienten mensajería real, estados y errores recuperables. Sin jerarquía visual decorativa que compita con precio, reputación, aceptación o siguiente paso.

**Vistas de referencia para la transformación:** inicio, búsqueda/filtros, categorías, detalle del servicio, perfil del prestador, conversaciones/propuestas, seguimiento del trabajo, alta de prestador/gestión, cuenta/notificaciones y revisión/admin. Evitar mezcla de orange/pink heredados con navy/teal/mint nuevos.

## 5. Arquitectura de tokens a implementar

No usar reemplazo global de cadenas hexadecimales. Introducir tokens semánticos y migrar componente a componente, dejando rastreables excepciones:

| Token actual | Destino conceptual |
|---|---|
| `--color-canvas`, `--color-surface`, `--color-ink` | colores YALO light/dark |
| `--color-brand-orange`, `--color-terracotta` | tokens nuevos `--color-brand-primary`, `--color-brand-primary-strong` |
| `--color-brand-yellow`, `--color-brand-pink` | retirar usos identitarios y mantener solo semántica si corresponde |
| `--brand-gradient`, `--consumer-hero-gradient` | `--yalo-symbol-gradient`, acentos decorativos mesurados |
| `--consumer-shadow-*`, `--consumer-radius-*` | sombras menos profundas, radios coherentes |
| `--color-moss` (actual azul de foco) | `--color-focus` semántico e independiente |

Estrategia: primero definir base en `apps/web/src/app/globals.css`, luego migrar componentes explícitos (`brand-gradient-surface`, `cta-ink`, `StatusChip`, `IllustratedBadge`, `ServiceCard`, tabs/BottomNav/desktop nav, light/dark). Revisar `bg-white`, `text-white`, `#FF6B35`, `#EE5A24`, `#FF0A78`, `#FFC857` y gradientes hardcoded. **No cambiar el admin deliberadamente por accidente:** o asignar un tema YALO-admin intencionado o preservar su lenguaje operacional documentando la excepción.

## 6. Textos, SEO, PWA y naming técnico

Actualizar marca visible en:

- `apps/web/src/app/layout.tsx`: metadata, OpenGraph, template, theme color;
- `apps/web/src/app/manifest.ts`: name/short_name/description, labels screenshots y theme/background;
- `apps/web/src/app/page.tsx`, auth, cuenta, nav, proveedor, contacto, correos/push, empty states, textos estáticos, `HowItWorks`;
- `apps/web/src/app/opengraph-image.tsx`, `apps/web/src/app/p/[slug]/opengraph-image.tsx`, íconos `src/app/icon.svg` + `public/icon-*.svg/png` + apple icon y social previews;
- `apps/web/public/sw.js`: etiqueta de push, nombre de CACHE con versionado correcto y eliminación de entradas obsoletas, preservar seguridad `no cache navigational HTML`;
- `apps/web/src/app/robots.ts`, sitemaps, links legales: revisar dominios/canonicals/referencias públicas.

**Conservar por ahora:** `@changas/web`, `@changas/config`, nombres de repositorio, esquema Postgres, nombre de Supabase, ids Vercel, rutas `/jobs`, rutas `/provider`, `NEXT_PUBLIC_*` y secretos, `changas-theme` en localStorage (o lectura compatible), ids de push y DB y URLs actualmente en producción. Renombrar estos es una **migración técnica separada** con plan de compatibilidad, no parte del rebrand cosmético. No hay dominio nuevo confirmado. No cambiar `getPublicSiteUrl()` ni enlaces reales hasta tener dominio y redirects.

Revisar términos legales, política de privacidad, emisores de notificaciones y correos: el nombre comercial cambia, pero **no sustituir unilateralmente la razón social de la entidad legal**. Antes de registro público: búsqueda marcaria/registro, dominio, redes, disponibilidad y titularidad/licencia de la identidad gráfica. No afirmar verificación jurídica realizada.

## 7. Reglas de implementación y aceptación para Muse

- Trabajar en rama propia derivada de la rama de handoff; PR descriptivo; nada de despliegue, SQL productivo o activación de `PAYMENTS_ENABLED` sin permiso.
- No depender de GitHub Actions: validación local de typecheck, lint, pruebas y build, además de revisión manual. Conservar funcionalidad de cliente/prestador y simulaciones admin que ya existen.
- Dark/light/system: cambiar tokens y excepciones coherentemente, sin flashes ni dos mecanismos de dark mode compitiendo.
- Móvil Android (360, 390, 412 px) + tablet/desktop (768, 1280 px), safe areas, bottom-nav, teclados, sticky bars, foco y textos largos.
- Imágenes y avatar: fallback profesional, sin usar stock genérico para fingir trabajos reales. Fotografías del servicio solo si pertenecen al prestador/con permiso.
- Actualizar/validar todos los assets instalables (PWA + screenshot + iconos que podrían persistir en service worker antiguo); comprobar logout/login no sirve HTML de otra sesión.
- Comprobación de branding: búsqueda semántica en `apps/web` de `Changas` y los hex antiguos; justificar cada remanente (interno/histórico/legal) en PR.
- Ensayar el flujo de ambos roles y la matriz del [handoff](../../audits/2026-10-14-YALO-MUSE-HANDOFF.md) **sin pagos reales**.

## 8. No negociables de producto

1. Contratar = aceptar una propuesta con importe acordado; **no hay pago por adelantado**.
2. Trabajo `CONFIRMED → IN_PROGRESS → COMPLETION_REQUESTED → COMPLETED`, con excepciones y permisos existentes.
3. `PAYMENTS_ENABLED=false` hasta autorización expresa; no mostrar CTA de cobro operativo ni enviar recordatorios de pagos imposibles.
4. Reputación verificable y privacidad de documentos/ubicaciones/códigos; nunca sacrificar seguridad por estética.
5. **Premium = utilidad, consistencia, velocidad percibida, recuperación de errores y confianza, no cantidad de animaciones.**
