import Link from "next/link";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";

export default function AuthErrorPage() {
  return (
    <div className="border-ink/[0.08] bg-surface relative w-full max-w-md overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%),0_24px_70px_-20px_rgb(255_107_53/28%)] sm:p-8 dark:shadow-[0_24px_70px_-20px_rgb(0_0_0/70%)]">
      <span aria-hidden="true" className="brand-gradient-surface pointer-events-none absolute inset-x-0 top-0 h-1.5" />
      <span
        aria-hidden="true"
        className="brand-gradient-surface relative mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-[1.75rem] shadow-[0_18px_48px_rgb(255_107_53/18%)]"
      >
        <span
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
            backgroundSize: "12px 12px",
          }}
        />
        <span className="absolute -right-4 -bottom-5 h-16 w-16 rounded-full bg-white/20" />
        <span className="absolute -top-3 -left-3 h-10 w-10 rounded-full bg-white/15" />
        <IllustratedBadge tone="gold" icon="key" size="lg" label="Acceso" />
      </span>
      <p className="text-terracotta mt-5 text-xs font-semibold tracking-[0.18em] uppercase">
        Acceso
      </p>
      <h1 className="font-display mt-3 text-4xl leading-tight font-semibold">
        El enlace no es válido
      </h1>
      <p className="text-ink/70 mt-4 text-sm leading-6">
        El enlace pudo haber expirado o ya fue utilizado. Volvé a iniciar sesión
        para pedir otro.
      </p>
      <Link className="button-primary mt-8 w-full" href="/login">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
