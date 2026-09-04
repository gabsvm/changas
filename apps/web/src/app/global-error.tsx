"use client";

import { useEffect } from "react";

import { reportClientError, type ClientError } from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: ClientError;
  reset: () => void;
}>) {
  useEffect(() => {
    reportClientError("global", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-[#f5f1e9] text-[#163832]">
        <main className="grid min-h-screen place-items-center px-6 text-center">
          <div className="max-w-md">
            <p className="text-sm font-semibold tracking-[0.18em] text-[#b86145] uppercase">
              Changas
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold">
              La aplicación necesita volver a intentarlo.
            </h1>
            {error.digest ? (
              <p className="mt-3 text-xs text-[#163832]/60">
                Referencia: {error.digest}
              </p>
            ) : null}
            <button
              className="mt-7 rounded-full bg-[#163832] px-5 py-3 text-sm font-bold text-white"
              onClick={() => reset()}
              type="button"
            >
              Intentar de nuevo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
