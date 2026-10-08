"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "changas:install-dismissed-at";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed(): boolean {
  try {
    const stored = window.localStorage.getItem(DISMISSED_KEY);
    const timestamp = stored === null ? Number.NaN : Number(stored);
    return (
      Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_DURATION_MS
    );
  } catch {
    return false;
  }
}

function persistDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
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
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    persistDismissal();
    setDismissed(true);
  }

  async function installApp() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      dismiss();
    }
  }

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;
    // Installing is a phone/tablet gesture; do not interrupt desktop browsing.
    const touchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (!touchDevice && !isIosDevice()) return;

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
      persistDismissal();
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

  if (dismissed || pathname === "/offline" || (!deferredPrompt && !showIosGuide))
    return null;

  return (
    <aside
      className="border-ink/[0.08] bg-surface text-ink fixed right-3 bottom-[calc(var(--mobile-bottom-nav-height)+0.5rem)] left-3 z-[60] mx-auto flex max-h-[calc(100dvh-1rem)] max-w-lg flex-col overflow-hidden rounded-3xl border shadow-[0_1px_2px_rgb(23_20_15/8%),0_-18px_50px_rgba(32,33,36,0.18),0_24px_64px_-20px_rgb(255_107_53/35%)] backdrop-blur-xl sm:right-4 sm:bottom-4 sm:left-4 dark:shadow-[0_-18px_50px_rgba(0,0,0,0.5)]"
      aria-label="Instalar Changas"
      role="dialog"
      aria-modal="false"
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
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5V15M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
            </svg>
          </span>
          <span>
            <span className="block text-xs font-extrabold tracking-[0.16em] text-white/85 uppercase">
              App de Changas
            </span>
            <span className="font-display mt-0.5 block text-xl leading-6 font-extrabold tracking-[-0.02em] text-white">
              Tenela a mano como una app
            </span>
          </span>
        </span>
      </div>
      <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-end">
          <button
            className="consumer-pressable text-ink/70 hover:bg-ink/[0.05] inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-sm font-semibold"
            type="button"
            onClick={dismiss}
            aria-label="Cerrar sugerencia de instalación"
          >
            Cerrar
          </button>
        </div>
        {deferredPrompt ? (
          <>
            <p className="text-ink/70 mt-1 text-sm leading-6">
              Instalá Changas y abrila en un toque desde tu pantalla de
              inicio: volvés a tus conversaciones y avisos más rápido, sin
              buscar la pestaña del navegador.
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
          <p className="text-ink/70 mt-3 text-sm leading-6">
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
