import type { Metadata, Viewport } from "next";

import { getPublicSiteUrl } from "@changas/config/public";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: "Changas",
    template: "%s · Changas",
  },
  description:
    "Una base confiable para conectar habilidades con oportunidades.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Changas",
    description:
      "Una base confiable para conectar habilidades con oportunidades.",
    type: "website",
    url: "/",
  },
};

export const viewport: Viewport = {
  themeColor: "#163832",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main-content">
          Ir al contenido principal
        </a>
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
