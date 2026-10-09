"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@changas/validation";

import type { ActionState } from "@/lib/forms/action-state";
import {
  deletePushSubscription,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  upsertPushSubscription,
  type BrowserPushSubscription,
} from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export async function markNotificationReadAction(
  formData: FormData,
): Promise<void> {
  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string" || !isUuid(notificationId)) {
    throw new Error("Notificación inválida.");
  }

  const supabase = await createClient();
  const updated = await markNotificationRead(supabase, notificationId);
  if (!updated) {
    throw new Error("No pudimos marcar la notificación como leída.");
  }

  revalidatePath("/account/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  await markAllNotificationsRead(supabase);
  revalidatePath("/account/notifications");
}

export async function updateNotificationPreferencesAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const current = await getNotificationPreferences(supabase);

    await updateNotificationPreferences(supabase, {
      pushActionableEnabled: current.pushActionableEnabled,
      // Email channel not wired yet: the toggle is disabled, so a missing
      // checkbox must not wipe the stored preference.
      emailImportantEnabled: current.emailImportantEnabled,
      jobRemindersEnabled: checkbox(formData, "jobRemindersEnabled"),
      proposalAlertsEnabled: checkbox(formData, "proposalAlertsEnabled"),
      verificationAlertsEnabled: checkbox(
        formData,
        "verificationAlertsEnabled",
      ),
      promotionalEnabled: checkbox(formData, "promotionalEnabled"),
    });

    revalidatePath("/account/notifications");
    return { success: "Preferencias actualizadas." };
  } catch {
    return { error: "No pudimos guardar tus preferencias de notificaciones." };
  }
}

type PushActionResult = { ok: true } | { ok: false; error: string };

const PUSH_ENDPOINT_ALLOWLIST: Record<string, true> = {
  "fcm.googleapis.com": true,
  "updates.push.services.mozilla.com": true,
  "web.push.apple.com": true,
  "push.apple.com": true,
};

function decodedBase64UrlLength(value: string): number | null {
  if (value.length === 0 || value.length > 512) return null;
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  try {
    return Buffer.from(value, "base64url").length;
  } catch {
    return null;
  }
}

function validPushSubscription(
  subscription: BrowserPushSubscription,
): boolean {
  if (
    subscription.endpoint.length < 8 ||
    subscription.endpoint.length > 4096
  ) {
    return false;
  }
  let endpointHost: string;
  try {
    const url = new URL(subscription.endpoint);
    if (url.protocol !== "https:") return false;
    endpointHost = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!PUSH_ENDPOINT_ALLOWLIST[endpointHost]) return false;
  // Claves Web Push reales: p256dh es un punto P-256 sin comprimir (65
  // bytes) y auth un secreto de 16 bytes, ambos en base64url.
  if (decodedBase64UrlLength(subscription.p256dh) !== 65) return false;
  if (decodedBase64UrlLength(subscription.auth) !== 16) return false;
  return !subscription.userAgent || subscription.userAgent.length <= 512;
}

export async function savePushSubscriptionAction(
  subscription: BrowserPushSubscription,
): Promise<PushActionResult> {
  if (!validPushSubscription(subscription)) {
    return { ok: false, error: "Suscripción push inválida." };
  }

  try {
    const supabase = await createClient();
    const current = await getNotificationPreferences(supabase);

    await upsertPushSubscription(supabase, subscription);
    await updateNotificationPreferences(supabase, {
      pushActionableEnabled: true,
      emailImportantEnabled: current.emailImportantEnabled,
      jobRemindersEnabled: current.jobRemindersEnabled,
      proposalAlertsEnabled: current.proposalAlertsEnabled,
      verificationAlertsEnabled: current.verificationAlertsEnabled,
      promotionalEnabled: current.promotionalEnabled,
    });

    revalidatePath("/account/notifications");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No pudimos activar las notificaciones push.",
    };
  }
}

export async function disablePushSubscriptionAction(
  endpoint: string | null,
): Promise<PushActionResult> {
  try {
    const supabase = await createClient();
    const current = await getNotificationPreferences(supabase);

    await updateNotificationPreferences(supabase, {
      pushActionableEnabled: false,
      emailImportantEnabled: current.emailImportantEnabled,
      jobRemindersEnabled: current.jobRemindersEnabled,
      proposalAlertsEnabled: current.proposalAlertsEnabled,
      verificationAlertsEnabled: current.verificationAlertsEnabled,
      promotionalEnabled: current.promotionalEnabled,
    });

    if (endpoint?.startsWith("https://")) {
      await deletePushSubscription(supabase, endpoint);
    }

    revalidatePath("/account/notifications");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No pudimos desactivar las notificaciones push.",
    };
  }
}
