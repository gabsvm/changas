import Link from "next/link";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SiteFooter } from "@/components/ui/site-footer";

const HERO_POINTS = [
  {
    tone: "orange",
    icon: "briefcase",
    title: "Pedí servicios",
    text: "Publicá lo que necesitás en minutos.",
  },
  {
    tone: "blue",
    icon: "shield",
    title: "Elegí con confianza",
    text: "Perfiles verificados y reseñas reales.",
  },
  {
    tone: "green",
    icon: "chat",
    title: "Coordiná directo",
    text: "Chat y avisos sin intermediarios.",
  },
] as const;

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main-content"
      className="yalo-ui bg-canvas text-ink min-h-screen overflow-x-clip px-5 py-5 sm:px-8"
    >
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">
        <header className="yalo-auth-header border-ink/10 flex items-center justify-between border-b pb-5">
          <Link
            className="flex min-h-11 items-center gap-3"
            href="/"
            aria-label="YALO, inicio"
          >
            <span className="brand-mark" role="img" aria-label="YALO" />
            <span
              className="brand-wordmark text-xl text-white"
              aria-hidden="true"
            />
          </Link>
          
        </header>
        <div className="relative flex flex-1 items-center justify-center py-5 sm:py-12">
          
          
          <div className="relative z-10 grid w-full items-center gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            <section
              aria-label="Por qué usar YALO"
              className="yalo-auth-hero order-last hidden lg:order-first lg:block"
            >
              
              
              
              <div className="relative">
                <span className="font-display inline-flex items-center gap-2.5 text-3xl font-semibold tracking-[-0.06em] text-white">
                  <span className="brand-mark h-11 w-11" aria-hidden="true" />
                  <span
                    className="brand-wordmark"
                    role="img"
                    aria-label="YALO"
                  />
                </span>
                
                <h2 className="font-display mt-3 text-4xl leading-[1.05] font-semibold tracking-[-0.035em]">
                  La ayuda que necesitás, a unas cuadras.
                </h2>
                <ul className="mt-8 space-y-4">
                  {HERO_POINTS.map((point) => (
                    <li
                      key={point.title}
                      className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/[0.06] p-3"
                    >
                      <IllustratedBadge
                        tone={point.tone}
                        icon={point.icon}
                        size="sm"
                      />
                      <span>
                        <span className="block text-[15px] font-semibold">
                          {point.title}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-white/85">
                          {point.text}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <div className="order-first w-full lg:order-last">{children}</div>
          </div>
        </div>
        <SiteFooter className="mt-0" />
      </div>
    </main>
  );
}
