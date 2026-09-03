"use client";

import { useEffect, useState } from "react";

import {
  disablePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/app/(account)/account/notifications/actions";

import { resolvePushCapability, type PushCapability } from "./push-permission";

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function PushOptIn({
  publicKey,
  initialEnabled,
}: {
  publicKey: string;
  initialEnabled: boolean;
}) {
  const [capability, setCapability] = useState<PushCapability>("unsupported");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const notificationSupported = "Notification" in window;
    const serviceWorkerSupported = "serviceWorker" in navigator;
    const permission = notificationSupported
      ? Notification.permission
      : "default";
    const nextCapability = resolvePushCapability({
      notificationSupported,
      serviceWorkerSupported,
      permission,
    });

    queueMicrotask(() => setCapability(nextCapability));

    if (!notificationSupported || !serviceWorkerSupported) return;

    void navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription && initialEnabled) {
          setEnabled(false);
        }
      });
  }, [initialEnabled]);

  async function enablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setCapability("unsupported");
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      setCapability(
        resolvePushCapability({
          notificationSupported: true,
          serviceWorkerSupported: true,
          permission,
        }),
      );

      if (permission !== "granted") {
        setMessage(
          "Las notificaciones dentro de Changas siguen funcionando aunque el navegador no permita push.",
        );
        return;
      }

      if (!publicKey) {
        setMessage("Las notificaciones push todavía no están configuradas.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!p256dh || !auth) {
        if (!existing) await subscription.unsubscribe();
        setMessage("El navegador no devolvió una suscripción push válida.");
        return;
      }

      const result = await savePushSubscriptionAction({
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64Url(p256dh),
        auth: arrayBufferToBase64Url(auth),
        userAgent: navigator.userAgent || null,
      });

      if (!result.ok) {
        if (!existing) await subscription.unsubscribe();
        setMessage(result.error);
        return;
      }

      setEnabled(true);
      setMessage("Notificaciones push activadas en este dispositivo.");
    } catch {
      setMessage(
        "No pudimos activar las notificaciones push en este dispositivo.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    if (!("serviceWorker" in navigator)) {
      setEnabled(false);
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const result = await disablePushSubscriptionAction(
        subscription?.endpoint ?? null,
      );

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      if (subscription) await subscription.unsubscribe();
      setEnabled(false);
      setMessage("Notificaciones push desactivadas en este dispositivo.");
    } catch {
      setMessage("No pudimos desactivar las notificaciones push.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        Push
      </p>
      <h2 className="font-display mt-2 text-2xl font-semibold">
        Alertas en este dispositivo
      </h2>
      <p className="text-ink/60 mt-2 text-sm leading-6">
        Changas sólo pide permiso cuando tocás el botón. El texto que aparece en
        la pantalla bloqueada es genérico; los detalles quedan dentro de la app.
      </p>

      {capability === "unsupported" ? (
        <p className="bg-ink/5 text-ink/70 mt-4 rounded-xl px-4 py-3 text-sm leading-5">
          Este navegador no ofrece Web Push en este contexto. En iPhone o iPad,
          instalá Changas en la pantalla de inicio cuando el navegador lo
          requiera. Las notificaciones dentro de la app siguen disponibles.
        </p>
      ) : null}

      {capability === "denied" ? (
        <p className="bg-terracotta/10 text-terracotta mt-4 rounded-xl px-4 py-3 text-sm leading-5">
          El navegador tiene bloqueado el permiso. Podés cambiarlo desde la
          configuración del sitio; las notificaciones dentro de Changas siguen
          funcionando.
        </p>
      ) : null}

      {message ? (
        <p
          className="bg-moss/10 text-moss mt-4 rounded-xl px-4 py-3 text-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="mt-5">
        {enabled ? (
          <button
            className="border-ink/20 rounded-full border px-5 py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
            type="button"
            onClick={disablePush}
            disabled={pending}
          >
            {pending ? "Desactivando…" : "Desactivar push"}
          </button>
        ) : (
          <button
            className="button-primary disabled:cursor-wait disabled:opacity-60"
            type="button"
            onClick={enablePush}
            disabled={
              pending || capability === "unsupported" || capability === "denied"
            }
          >
            {pending ? "Activando…" : "Activar notificaciones push"}
          </button>
        )}
      </div>
    </section>
  );
}
