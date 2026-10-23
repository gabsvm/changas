# Regenerar assets YALO

`apps/web/public/brand/yalo-symbol.svg` y `yalo-wordmark-template.svg` son las fuentes de la silueta y el lettering. Las variantes SVG y los iconos se regeneran desde `apps/web` con:

```sh
node scripts/generate-pwa-assets.mjs
```

El generador escribe los iconos `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, sus SVG de app, dos wordmarks y los lockups de marca en `public/brand/`. Next también recibe `src/app/icon.svg` y `src/app/apple-icon.png`. El fondo de app usa navy `#0D121B`; el icono normal tiene esquinas redondeadas y el maskable conserva todo el arte dentro del círculo central de radio 40%.

Para validar la geometría y la regeneración reproducible sin sobrescribir assets del repo, las pruebas ejecutan el generador en un directorio temporal: `pnpm exec vitest run apps/web/src/lib/notifications/pwa-contract.test.ts` desde la raíz.

Las dos fuentes de marca reconstruyen la referencia visual aportada y mantienen el lettering como paths vectoriales; su geometría y colores siguen siendo aproximaciones, no los originales del diseñador. Los screenshots PWA existentes requieren capturas reales de la interfaz y no se regeneran con este script.
