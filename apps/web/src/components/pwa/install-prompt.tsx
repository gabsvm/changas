"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  const displayModeStandalone = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  // navigator.standalone is the iOS homescreen signal Safari exposes.
  return displayModeStandalone || iosStandalone === true;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/u.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function installApp() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setDismissed(true);
    }
  }

  useEffect(() => {
    if (isStandalone()) return;

    if (isIosDevice()) {
      queueMicrotask(() => setShowIosGuide(true));
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setDeferredPrompt(null);
      setShowIosGuide(false);
      setDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (dismissed || (!deferredPrompt && !showIosGuide)) return null;

  return (
    <aside
      className="border-ink/10 bg-canvas/95 text-ink fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-lg rounded-2xl border p-5 shadow-xl backdrop-blur"
      aria-label="Instalar Changas"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
            App de Changas
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold">
            Tenela a mano como una app
          </h2>
        </div>
        <button
          className="text-ink/55 rounded-full px-2 py-1 text-sm"
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar sugerencia de instalación"
        >
          Cerrar
        </button>
      </div>

      {deferredPrompt ? (
        <>
          <p className="text-ink/65 mt-3 text-sm leading-6">
            Instalá Changas desde el navegador para abrirla más rápido y usarla
            en modo standalone.
          </p>
          <button
            className="button-primary mt-4"
            type="button"
            onClick={installApp}
          >
            Instalar Changas
          </button>
        </>
      ) : (
        <p className="text-ink/65 mt-3 text-sm leading-6">
          En iPhone, tocá <strong>Compartir</strong> y después
          <strong> Agregar a pantalla de inicio</strong>. iOS no ofrece un botón
          de instalación web programático, por eso te mostramos estos pasos.
        </p>
      )}
    </aside>
  );
}
