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
      className="border-ink/10 bg-canvas/96 text-ink fixed right-3 bottom-2 left-3 z-[60] mx-auto flex max-h-[calc(100dvh-1rem)] max-w-lg flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_-18px_50px_rgba(32,33,36,0.18)] backdrop-blur-xl sm:right-4 sm:bottom-4 sm:left-4"
      aria-label="Instalar Changas"
      role="dialog"
      aria-modal="false"
    >
      <div
        className="brand-gradient-surface h-1.5 shrink-0"
        aria-hidden="true"
      />
      <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
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
            className="consumer-pressable text-ink/55 hover:bg-ink/[0.05] inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-sm font-semibold"
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
              Instalá Changas desde el navegador para abrirla más rápido y
              usarla en modo standalone.
            </p>
            <button
              className="button-primary mt-4 w-full whitespace-nowrap"
              type="button"
              onClick={installApp}
            >
              Instalar Changas
            </button>
          </>
        ) : (
          <p className="text-ink/65 mt-3 text-sm leading-6">
            En iPhone, tocá <strong>Compartir</strong> y después
            <strong> Agregar a pantalla de inicio</strong>. iOS no ofrece un
            botón de instalación web programático, por eso te mostramos estos
            pasos.
          </p>
        )}
      </div>
    </aside>
  );
}
