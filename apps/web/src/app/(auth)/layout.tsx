import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main-content"
      className="bg-canvas text-ink min-h-screen px-5 py-5 sm:px-8"
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
            <span className="font-display text-xl font-semibold tracking-tight">
              Changas
            </span>
          </Link>
          <span className="text-ink/50 text-xs font-semibold tracking-[0.16em] uppercase">
            Cuenta
          </span>
        </header>
        <div className="flex flex-1 items-center justify-center py-12">
          {children}
        </div>
      </div>
    </main>
  );
}
