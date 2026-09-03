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

    void navigator.serviceWorker.register("/sw.js").then((registration) => {
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
      className="bg-ink fixed right-4 bottom-4 left-4 z-50 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl px-5 py-4 text-sm text-white shadow-xl"
      role="status"
    >
      <span>Hay una versión nueva de Changas lista para usar.</span>
      <button
        className="rounded-full bg-white px-4 py-2 font-semibold text-[#163832]"
        type="button"
        onClick={() => {
          reloadOnControllerChange.current = true;
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Actualizar
      </button>
    </aside>
  );
}
