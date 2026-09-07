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
            <span className="font-display text-xl font-extrabold tracking-[-0.035em]">
              Changas
            </span>
          </Link>
          <span className="text-terracotta text-xs font-extrabold tracking-[0.16em] uppercase">
            Cuenta
          </span>
        </header>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden py-12">
          <div
            className="bg-brand-yellow/20 pointer-events-none absolute -top-20 -right-24 h-56 w-56 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div
            className="bg-brand-orange/10 pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 w-full">{children}</div>
        </div>
      </div>
    </main>
  );
}
