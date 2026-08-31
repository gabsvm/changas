import Link from "next/link";

export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-5 py-5 sm:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-ink/10 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
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
          <nav className="flex flex-wrap items-center justify-end gap-4 text-sm" aria-label="Cuenta">
            <Link className="underline underline-offset-4" href="/messages">
              Mensajes
            </Link>
            <Link className="underline underline-offset-4" href="/account">
              Cuenta
            </Link>
            <Link
              className="underline underline-offset-4"
              href="/account/settings"
            >
              Configuración
            </Link>
            <Link
              className="underline underline-offset-4"
              href="/account/favorites"
            >
              Guardados
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
