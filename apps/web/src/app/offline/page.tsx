import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-5 py-12">
      <section className="border-ink/10 w-full max-w-xl rounded-[2rem] border bg-white/55 p-8 shadow-sm sm:p-12">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <p className="text-terracotta mt-8 text-xs font-semibold tracking-[0.18em] uppercase">
          Sin conexión
        </p>
        <h1 className="font-display mt-3 text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-5xl">
          Changas necesita internet para mostrar datos actualizados.
        </h1>
        <p className="text-ink/65 mt-5 text-sm leading-6">
          No mostramos trabajos, pagos, mensajes ni datos privados desde una
          copia vieja. Cuando vuelva la conexión, recargá para continuar con
          información vigente.
        </p>
        <Link className="button-primary mt-8" href="/">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
