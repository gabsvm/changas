"use client";

import Link from "next/link";
import { useEffect } from "react";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { reportClientError, type ClientError } from "@/lib/observability";

export default function Error({
  error,
  reset,
}: Readonly<{
  error: ClientError;
  reset: () => void;
}>) {
  useEffect(() => {
    reportClientError("route", error);
  }, [error]);

  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-6 text-center">
      <div className="border-ink/[0.08] bg-surface relative w-full max-w-md overflow-hidden rounded-[1.75rem] border px-6 py-10 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%),0_24px_70px_-20px_rgb(255_107_53/28%)] dark:shadow-[0_24px_70px_-20px_rgb(0_0_0/70%)]">
        <span
          aria-hidden="true"
          className="brand-gradient-surface pointer-events-none absolute inset-x-0 top-0 h-1.5"
        />
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
          <IllustratedBadge tone="rose" icon="alert" size="lg" label="Error" />
        </span>
        <p className="text-terracotta mt-6 text-sm font-semibold tracking-[0.18em] uppercase">
          Changas
        </p>
        <h1 className="font-display mt-4 text-4xl font-semibold">
          Algo no salió como esperábamos.
        </h1>
        <p className="text-ink/75 mt-4">
          Podés intentar cargar esta vista nuevamente.
        </p>
        {error.digest ? (
          <p className="text-ink/75 mt-3 text-xs" data-testid="error-reference">
            Referencia: {error.digest}
          </p>
        ) : null}
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            className="button-primary w-full sm:w-auto"
            onClick={() => reset()}
            type="button"
          >
            Intentar de nuevo
          </button>
          <Link className="button-secondary w-full sm:w-auto" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
