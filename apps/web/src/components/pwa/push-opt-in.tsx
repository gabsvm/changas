"use client";

import { useEffect, useState } from "react";

import {
  disablePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/app/(account)/account/notifications/actions";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { Switch } from "@/components/ui/marketplace/switch";
import {
  resolvePushMessageTone,
  type PushMessageKind,
  type PushMessageTone,
} from "@/lib/ui/account-settings";

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
  const [message, setMessage] = useState<{
    text: string;
    tone: PushMessageTone;
  } | null>(null);

  function notify(text: string, kind: PushMessageKind) {
    setMessage({ text, tone: resolvePushMessageTone(kind) });
  }

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
        notify(
          "El navegador no habilitó las alertas push.",
          "permission-denied",
        );
        return;
      }

      if (!publicKey) {
        setEnabled(false);
        notify(
          "Las notificaciones push todavía no están configuradas.",
          "not-configured",
        );
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
        notify(
          "El navegador no devolvió una suscripción push válida.",
          "invalid-subscription",
        );
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
        notify(result.error, "save-failed");
        return;
      }

      setEnabled(true);
      notify("Push activado en este dispositivo.", "enabled");
    } catch {
      setEnabled(false);
      notify("No pudimos activar las notificaciones push.", "save-failed");
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    setPending(true);
    setMessage(null);

    try {
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration()
          : undefined;
      const subscription = await registration?.pushManager.getSubscription();
      const result = await disablePushSubscriptionAction(
        subscription?.endpoint ?? null,
      );

      if (!result.ok) {
        notify(result.error, "disable-failed");
        return;
      }

      if (subscription) await subscription.unsubscribe();
      setEnabled(false);
      notify("Push desactivado en este dispositivo.", "disabled");
    } catch {
      notify(
        "No pudimos desactivar las notificaciones push.",
        "disable-failed",
      );
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
          className={
            message.tone === "error"
              ? "bg-danger/[0.07] text-danger px-4 py-2.5 text-sm font-semibold"
              : "bg-success/[0.07] text-success px-4 py-2.5 text-sm font-semibold"
          }
          role={message.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
