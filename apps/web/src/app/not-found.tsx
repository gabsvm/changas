import Link from "next/link";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";

export default function NotFound() {
  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-6 text-center">
      <div className="border-ink/[0.08] bg-surface relative w-full max-w-md overflow-hidden rounded-[1.75rem] border px-6 py-10 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%),0_24px_70px_-20px_rgb(13_18_27/28%)] dark:shadow-[0_24px_70px_-20px_rgb(0_0_0/70%)]">
        <span
          aria-hidden="true"
          className="brand-gradient-surface pointer-events-none absolute inset-x-0 top-0 h-1.5"
        />
        <span
          aria-hidden="true"
          className="brand-gradient-surface relative mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-[1.75rem] shadow-[0_18px_48px_rgb(13_18_27/18%)]"
        >
          
          
          
          <IllustratedBadge
            tone="violet"
            icon="compass"
            size="lg"
            label="Página no encontrada"
          />
        </span>
        <p className="text-terracotta mt-6 text-sm font-semibold">
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
