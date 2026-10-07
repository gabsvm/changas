import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-terracotta text-sm font-semibold tracking-[0.18em] uppercase">
          404
        </p>
        <h1 className="font-display mt-4 text-4xl font-semibold">
          No encontramos esa página.
        </h1>
        <p className="text-ink/75 mt-4">
          La dirección puede haber cambiado o todavía no existir.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link className="button-primary w-full sm:w-auto" href="/">
            Volver al inicio
          </Link>
          <Link className="button-secondary w-full sm:w-auto" href="/buscar">
            Ir a buscar
          </Link>
        </div>
      </div>
    </main>
  );
}
