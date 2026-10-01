"use client";

import { useEffect } from "react";

import { reportClientError, type ClientError } from "@/lib/observability";

export function SegmentError({
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
    <section className="grid min-h-[60vh] place-items-center px-2 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-2xl font-extrabold">
          No pudimos cargar esta sección
        </h1>
        <p className="text-ink/70 mt-3 text-sm leading-6">
          Tus datos están a salvo. Probá de nuevo o volvé a otra pestaña.
        </p>
        {error.digest ? (
          <p className="text-ink/70 mt-3 text-xs" data-testid="error-reference">
            Referencia: {error.digest}
          </p>
        ) : null}
        <button
          className="button-primary mt-6"
          onClick={() => reset()}
          type="button"
        >
          Intentar de nuevo
        </button>
      </div>
    </section>
  );
}
