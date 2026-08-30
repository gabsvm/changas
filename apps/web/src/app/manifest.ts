import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Changas",
    short_name: "Changas",
    description:
      "Una base confiable para conectar habilidades con oportunidades.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f1e9",
    theme_color: "#163832",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
