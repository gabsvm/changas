"use client";

import { useEffect, useState } from "react";

import {
  disablePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/app/(account)/account/notifications/actions";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { Switch } from "@/components/ui/marketplace/switch";

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
    const permission = notificationSupported ? Notification.permission : "default";
    const nextCapability = resolvePushCapability({
      notificationSupported,
      serviceWorkerSupported,
      permission,
    });

    queueMicrotask(() => setCapability(nextCapability));

    if (!notificationSupported || !serviceWorkerSupported) return;

    void navigator.serviceWorker.getRegistration().then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription && initialEnabled) setEnabled(false);
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
        setEnabled(false);
        setMessage("El navegador no habilitó las alertas push.");
        return;
      }

      if (!publicKey) {
        setEnabled(false);
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
        setEnabled(false);
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
        setEnabled(false);
        setMessage(result.error);
        return;
      }

      setEnabled(true);
      setMessage("Push activado en este dispositivo.");
    } catch {
      setEnabled(false);
      setMessage("No pudimos activar las notificaciones push.");
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    setPending(true);
    setMessage(null);

    try {
      const registration = "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
      const subscription = await registration?.pushManager.getSubscription();
      const result = await disablePushSubscriptionAction(subscription?.endpoint ?? null);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      if (subscription) await subscription.unsubscribe();
      setEnabled(false);
      setMessage("Push desactivado en este dispositivo.");
    } catch {
      setMessage("No pudimos desactivar las notificaciones push.");
    } finally {
      setPending(false);
    }
  }

  const unavailable = capability === "unsupported" || capability === "denied";
  const description =
    capability === "unsupported"
      ? "Este navegador no ofrece Web Push en este contexto."
      : capability === "denied"
        ? "El permiso está bloqueado en la configuración del navegador."
        : "Alertas importantes incluso cuando Changas está cerrado.";

  return (
    <div>
      <SettingsRow
        title="Push"
        description={description}
        trailing={
          <Switch
            checked={enabled}
            disabled={pending || unavailable}
            onChange={(event) => {
              if (event.currentTarget.checked) void enablePush();
              else void disablePush();
            }}
            ariaLabel="Notificaciones push"
          />
        }
      />
      {message ? (
        <p
          className={`pb-3 text-xs ${message.includes("No pudimos") || message.includes("no habilitó") ? "text-danger" : "text-ink/50"}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
