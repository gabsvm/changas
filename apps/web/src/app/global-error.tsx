"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError, type ClientError } from "@/lib/observability";

const COVER: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 90% at 0% 0%, rgb(255 255 255 / 30%), transparent 55%), linear-gradient(135deg, #ffb340 0%, #ff7a2f 46%, #f2531c 100%)",
};

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
      <body style={{ margin: 0, background: "#fbf8f3", color: "#17140f" }}>
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            placeItems: "center",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              width: "100%",
              maxWidth: "28rem",
              borderRadius: "1.75rem",
              border: "1px solid rgb(23 20 15 / 8%)",
              background: "#ffffff",
              padding: "2.5rem 1.5rem",
              boxShadow:
                "0 1px 2px rgb(23 20 15 / 6%), 0 8px 20px -6px rgb(23 20 15 / 12%), 0 24px 70px -20px rgb(255 107 53 / 28%)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                insetInline: 0,
                top: 0,
                height: "6px",
                ...COVER,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "relative",
                display: "grid",
                placeItems: "center",
                width: "7rem",
                height: "7rem",
                margin: "0 auto",
                borderRadius: "1.75rem",
                color: "white",
                fontSize: "2.5rem",
                fontWeight: 800,
                boxShadow: "0 18px 48px rgb(255 107 53 / 30%)",
                ...COVER,
              }}
            >
              !
            </span>
            <p
              style={{
                marginTop: "1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#c84010",
              }}
            >
              Changas
            </p>
            <h1 style={{ marginTop: "1rem", fontSize: "2.25rem" }}>
              La aplicación necesita volver a intentarlo.
            </h1>
            {error.digest ? (
              <p
                style={{ marginTop: "0.75rem", fontSize: "0.75rem", opacity: 0.75 }}
                data-testid="error-reference"
              >
                Referencia: {error.digest}
              </p>
            ) : null}
            <div
              style={{
                marginTop: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <button
                style={{
                  borderRadius: "999px",
                  background: "#17140f",
                  padding: "0.75rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => reset()}
                type="button"
              >
                Intentar de nuevo
              </button>
              <Link
                style={{
                  borderRadius: "999px",
                  border: "1px solid rgb(23 20 15 / 25%)",
                  padding: "0.75rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "#17140f",
                  textDecoration: "none",
                }}
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
