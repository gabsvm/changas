import Link from "next/link";

const foundationCards = [
  {
    eyebrow: "Base técnica",
    title: "Una experiencia clara desde cualquier pantalla.",
    body: "La estructura nace mobile-first y mantiene el espacio necesario para crecer en desktop.",
  },
  {
    eyebrow: "Confianza",
    title: "Las decisiones importantes quedan preparadas para ser auditables.",
    body: "El dominio, la validación y la configuración viven separados de la interfaz.",
  },
  {
    eyebrow: "Evolución",
    title: "Web hoy; contratos reutilizables mañana.",
    body: "Los límites compartidos dejan abierta la puerta a futuras superficies móviles.",
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="bg-canvas text-ink min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="border-ink/10 flex items-center justify-between border-b pb-5">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              Changas
            </span>
          </Link>
          <span className="border-ink/15 text-ink/65 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase">
            Foundation
          </span>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-terracotta mb-6 text-sm font-semibold tracking-[0.2em] uppercase">
              Tus habilidades tienen valor
            </p>
            <h1 className="font-display text-ink text-5xl leading-[0.98] font-semibold tracking-[-0.04em] sm:text-7xl">
              Una base serena para hacer que las cosas pasen.
            </h1>
            <p className="text-ink/70 mt-7 max-w-xl text-lg leading-8 sm:text-xl">
              Changas empieza con una base rápida, accesible y lista para crecer
              con confianza.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a className="button-primary" href="#foundation">
                Conocer la base
              </a>
              <Link className="button-secondary" href="/health">
                Ver estado del sistema
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="border-ink/10 relative rounded-[2rem] border bg-white/75 p-6 shadow-[0_24px_80px_rgba(22,56,50,0.12)] backdrop-blur sm:p-8">
              <div className="border-ink/10 flex items-center justify-between border-b pb-5">
                <span className="text-ink/65 text-sm font-semibold">
                  Changas / 00
                </span>
                <span className="text-moss flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
                  <span className="status-dot" aria-hidden="true" />
                  Online
                </span>
              </div>
              <div className="py-10">
                <p className="text-ink/55 text-sm">
                  Un lugar donde empieza el trabajo bien hecho.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="bg-ink/10 h-3 w-4/5 rounded-full" />
                  <div className="bg-ink/10 h-3 w-3/5 rounded-full" />
                  <div className="bg-terracotta/30 h-3 w-2/5 rounded-full" />
                </div>
              </div>
              <div className="bg-moss rounded-2xl px-5 py-4 text-sm leading-6 text-white/90">
                La confianza se construye desde la primera línea de código.
              </div>
            </div>
          </div>
        </section>

        <section
          id="foundation"
          className="border-ink/10 grid gap-4 border-t py-10 md:grid-cols-3"
        >
          {foundationCards.map((card) => (
            <article
              className="border-ink/10 rounded-2xl border bg-white/45 p-5"
              key={card.eyebrow}
            >
              <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
                {card.eyebrow}
              </p>
              <h2 className="font-display text-ink mt-4 text-2xl leading-tight font-semibold">
                {card.title}
              </h2>
              <p className="text-ink/65 mt-3 text-sm leading-6">{card.body}</p>
            </article>
          ))}
        </section>

        <footer className="border-ink/10 text-ink/50 flex flex-col gap-2 border-t py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>Phase 00 · Foundation</span>
          <span>Construido para crecer con criterio.</span>
        </footer>
      </div>
    </main>
  );
}
