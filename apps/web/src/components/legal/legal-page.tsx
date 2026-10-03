import Link from "next/link";
import type { ReactNode } from "react";

// Flip to false once a lawyer has reviewed the texts and the [COMPLETAR]
// company fields have been filled in.
export const LEGAL_DOCUMENTS_ARE_DRAFT = true;

export const LEGAL_LAST_UPDATED = "2 de octubre de 2026";

const navLinkClass = "text-terracotta underline-offset-4 hover:underline";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-4 pb-16 sm:px-8"
    >
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex min-h-14 items-center pt-2">
          <Link
            href="/"
            className="consumer-pressable text-terracotta inline-flex min-h-11 items-center text-sm font-bold"
          >
            ← Volver a Changas
          </Link>
        </header>
        <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.035em]">
          {title}
        </h1>
        <p className="text-ink/70 mt-2 text-sm leading-6">{intro}</p>
        <p className="text-ink/70 mt-1 text-xs">
          Última actualización: {LEGAL_LAST_UPDATED}
        </p>
        {LEGAL_DOCUMENTS_ARE_DRAFT ? (
          <p
            role="note"
            className="bg-brand-yellow/25 text-ink mt-4 rounded-xl px-4 py-3 text-sm leading-6"
          >
            <strong>Versión preliminar.</strong> Este texto todavía está en
            revisión legal y puede cambiar antes del lanzamiento. Los datos
            entre corchetes serán completados por el titular del servicio.
          </p>
        ) : null}
        <div className="mt-8 space-y-8">{children}</div>
        <nav
          aria-label="Documentos legales"
          className="border-ink/10 mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm font-semibold"
        >
          <Link className={navLinkClass} href="/terminos">
            Términos y condiciones
          </Link>
          <Link className={navLinkClass} href="/privacidad">
            Política de privacidad
          </Link>
          <Link className={navLinkClass} href="/cookies">
            Cookies y almacenamiento
          </Link>
        </nav>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-extrabold tracking-[-0.02em]">{title}</h2>
      <div className="text-ink/80 mt-2 space-y-3 text-[15px] leading-7">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
