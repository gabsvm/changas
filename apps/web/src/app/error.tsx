"use client";

import Link from "next/link";
import { useEffect } from "react";

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
      <div className="max-w-md">
        <p className="text-terracotta text-sm font-semibold tracking-[0.18em] uppercase">
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
