"use server";

import { revalidatePath } from "next/cache";

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export async function markNotificationReadAction(
  formData: FormData,
): Promise<void> {
  const notificationId = formData.get("notificationId");
  if (
    typeof notificationId !== "string" ||
    !UUID_PATTERN.test(notificationId)
  ) {
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
      emailImportantEnabled: checkbox(formData, "emailImportantEnabled"),
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

type PushActionResult =
  | { ok: true }
  | { ok: false; error: string };

function validPushSubscription(
  subscription: BrowserPushSubscription,
): boolean {
  if (!subscription.endpoint.startsWith("https://")) return false;
  if (subscription.endpoint.length < 8 || subscription.endpoint.length > 4096) {
    return false;
  }
  if (subscription.p256dh.length < 8 || subscription.p256dh.length > 4096) {
    return false;
  }
  if (subscription.auth.length < 4 || subscription.auth.length > 4096) {
    return false;
  }
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
