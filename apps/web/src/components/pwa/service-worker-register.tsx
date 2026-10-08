"use client";

import { useEffect, useRef, useState } from "react";

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const reloadOnControllerChange = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (cancelled) return;

        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(installing);
            }
          });
        });
      })
      .catch((error) => {
        console.error("[pwa] no pudimos registrar el service worker.", error);
      });

    const handleControllerChange = () => {
      if (reloadOnControllerChange.current) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <aside
      className="border-ink/[0.08] bg-surface text-ink fixed right-3 bottom-[calc(var(--mobile-bottom-nav-height)+0.5rem)] left-3 z-[60] mx-auto flex max-h-[calc(100dvh-1rem)] max-w-lg flex-col overflow-hidden rounded-3xl border shadow-[0_1px_2px_rgb(23_20_15/8%),0_-18px_50px_rgba(32,33,36,0.18),0_24px_64px_-20px_rgb(255_107_53/35%)] backdrop-blur-xl sm:right-4 sm:bottom-4 sm:left-4 dark:shadow-[0_-18px_50px_rgba(0,0,0,0.5)]"
      aria-label="Actualización disponible"
      role="status"
      aria-live="polite"
    >
      <div
        className="brand-gradient-surface relative shrink-0 overflow-hidden px-5 pt-5 pb-4"
        aria-hidden="true"
      >
        <span
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
            backgroundSize: "12px 12px",
          }}
        />
        <span className="absolute -right-6 -bottom-10 h-24 w-24 rounded-full bg-white/20" />
        <span className="absolute -top-5 -left-5 h-16 w-16 rounded-full bg-white/15" />
        <span className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-white backdrop-blur-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" />
            </svg>
          </span>
          <span>
            <span className="block text-xs font-extrabold tracking-[0.16em] text-white/85 uppercase">
              Actualización
            </span>
            <span className="font-display mt-0.5 block text-xl leading-6 font-extrabold tracking-[-0.02em] text-white">
              Hay una versión nueva lista
            </span>
          </span>
        </span>
      </div>
      <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <p className="text-ink/70 mt-1 text-sm leading-6">
          Recargá Changas para usar la última versión, con las mejoras y
          arreglos más recientes.
        </p>
        <button
          className="button-primary mt-4 w-full whitespace-nowrap"
          type="button"
          onClick={() => {
            reloadOnControllerChange.current = true;
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          Recargar
        </button>
      </div>
    </aside>
  );
}
