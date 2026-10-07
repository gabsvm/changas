"use client";

import Link from "next/link";
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
              <p
                className="mt-3 text-xs text-[#163832]/75"
                data-testid="error-reference"
              >
                Referencia: {error.digest}
              </p>
            ) : null}
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                className="mt-0 rounded-full bg-[#163832] px-5 py-3 text-sm font-bold text-white"
                onClick={() => reset()}
                type="button"
              >
                Intentar de nuevo
              </button>
              <Link
                className="rounded-full border border-[#163832]/25 px-5 py-3 text-sm font-bold text-[#163832]"
                href="/"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
