"use client";

import Link from "next/link";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";

export default function OfflinePage() {
  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-5 py-12">
      <section className="border-ink/[0.08] bg-surface relative w-full max-w-xl overflow-hidden rounded-[1.75rem] border p-8 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%),0_24px_70px_-20px_rgb(13_18_27/28%)] sm:p-12 dark:shadow-[0_24px_70px_-20px_rgb(0_0_0/70%)]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[var(--yalo-symbol-gradient)]"
        />
        <img
          src="/brand/yalo-symbol.svg"
          alt="YALO"
          className="h-14 w-14"
          width={56}
          height={56}
        />
        <span
          aria-hidden="true"
          className="brand-gradient-surface relative grid h-28 w-28 place-items-center overflow-hidden rounded-[1.75rem] shadow-[0_18px_48px_rgb(13_18_27/18%)]"
        >
          
          
          
          <IllustratedBadge
            tone="blue"
            icon="wifi"
            size="lg"
            label="Sin conexión"
          />
        </span>
        <p className="text-terracotta mt-8 text-xs font-semibold">
          Sin conexión
        </p>
        <h1 className="font-display mt-3 text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-5xl">
          YALO necesita internet para mostrar datos actualizados.
        </h1>
        <p className="text-ink/75 mt-5 text-sm leading-6">
          No mostramos trabajos, pagos, mensajes ni datos privados desde una
          copia vieja. Cuando vuelva la conexión, recargá para continuar con
          información vigente.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            className="button-primary w-full sm:w-auto"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reintentar conexión
          </button>
          <Link className="button-secondary w-full sm:w-auto" href="/">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
