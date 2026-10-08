import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Changas",
    short_name: "Changas",
    description:
      "Una base confiable para conectar habilidades con oportunidades.",
    categories: ["business", "lifestyle"],
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf8f3",
    theme_color: "#ff6b35",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/inicio-390x844.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "Inicio de Changas",
      },
      {
        src: "/screenshots/buscar-1280x720.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Buscador de servicios de Changas",
      },
    ],
    shortcuts: [
      {
        name: "Buscar servicios",
        url: "/buscar",
        description: "Explorá servicios y habilidades cerca tuyo.",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Mensajes",
        url: "/messages",
        description: "Seguí tus conversaciones activas.",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
