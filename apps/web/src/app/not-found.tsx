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
        <p className="text-ink/65 mt-4">
          La dirección puede haber cambiado o todavía no existir.
        </p>
        <Link className="button-primary mt-7" href="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
