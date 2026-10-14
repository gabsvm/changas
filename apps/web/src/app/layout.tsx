import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";

import { getPublicSiteUrl } from "@changas/config/public";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: "YALO",
    template: "%s · YALO",
  },
  description:
    "Una base confiable para conectar habilidades con oportunidades.",
  openGraph: {
    title: "YALO",
    description:
      "Una base confiable para conectar habilidades con oportunidades.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#161D2A" },
    { media: "(prefers-color-scheme: dark)", color: "#0D121B" },
  ],
  colorScheme: "light dark",
};

const themeInitScript =
  '(function(){try{var t=localStorage.getItem("changas-theme");if(t!=="light"&&t!=="dark"&&t!=="system")t="light";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.classList.toggle("dark",d);h.style.colorScheme=t==="system"?"light dark":t;}catch(e){}})();';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <Script id="changas-theme" strategy="beforeInteractive">
        {themeInitScript}
      </Script>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
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
