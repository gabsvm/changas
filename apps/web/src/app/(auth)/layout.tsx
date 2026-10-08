import Link from "next/link";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SiteFooter } from "@/components/ui/site-footer";

const HERO_POINTS = [
  { tone: "orange", icon: "briefcase", title: "Pedí changas", text: "Publicá lo que necesitás en minutos." },
  { tone: "blue", icon: "shield", title: "Elegí con confianza", text: "Perfiles verificados y reseñas reales." },
  { tone: "green", icon: "chat", title: "Coordiná directo", text: "Chat y avisos sin intermediarios." },
] as const;

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen overflow-x-clip px-5 py-5 sm:px-8"
    >
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">
        <header className="border-ink/10 flex items-center justify-between border-b pb-5">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-extrabold tracking-[-0.035em]">
              Changas
            </span>
          </Link>
          <span className="text-terracotta text-xs font-extrabold tracking-[0.16em] uppercase">
            Cuenta
          </span>
        </header>
        <div className="relative flex flex-1 items-center justify-center py-12">
          <div
            className="bg-brand-yellow/20 pointer-events-none absolute -top-20 -right-24 h-56 w-56 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div
            className="bg-brand-orange/10 pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 grid w-full items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            <section
              aria-label="Por qué usar Changas"
              className="brand-gradient-surface relative hidden overflow-hidden rounded-[1.75rem] p-8 text-white shadow-[0_4px_10px_rgb(255_107_53/14%),0_30px_64px_-18px_rgb(255_87_34/46%)] lg:block dark:shadow-[0_30px_64px_-18px_rgb(0_0_0/70%)]"
            >
              <span
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                  backgroundSize: "12px 12px",
                }}
                aria-hidden="true"
              />
              <span
                className="absolute -right-10 -bottom-12 h-44 w-44 rounded-full bg-white/20"
                aria-hidden="true"
              />
              <span
                className="absolute -top-8 -left-8 h-28 w-28 rounded-full bg-white/15"
                aria-hidden="true"
              />
              <div className="relative">
                <p className="text-xs font-extrabold tracking-[0.18em] text-white/85 uppercase">
                  Changas · trabajo de barrio
                </p>
                <h2 className="font-display mt-3 text-4xl leading-[1.05] font-extrabold tracking-[-0.035em]">
                  La ayuda que necesitás, a unas cuadras.
                </h2>
                <ul className="mt-8 space-y-4">
                  {HERO_POINTS.map((point) => (
                    <li
                      key={point.title}
                      className="flex items-start gap-3 rounded-2xl border border-white/25 bg-white/12 p-3 backdrop-blur-sm"
                    >
                      <IllustratedBadge
                        tone={point.tone}
                        icon={point.icon}
                        size="sm"
                      />
                      <span>
                        <span className="block text-[15px] font-extrabold">
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
            <div className="w-full">{children}</div>
          </div>
        </div>
        <SiteFooter className="mt-0" />
      </div>
    </main>
  );
}
