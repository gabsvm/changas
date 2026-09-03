import type {
  ClaimedDelivery,
  SafePushMessage,
  TransactionalEmail,
} from "./types";

const SAFE_ACTION_ROOTS = ["/messages", "/jobs", "/account", "/provider"];
const DEFAULT_ACTION_URL = "/account/notifications";

export function sanitizeNotificationActionUrl(actionUrl: string): string {
  if (!actionUrl.startsWith("/") || actionUrl.startsWith("//")) {
    return DEFAULT_ACTION_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(actionUrl, "https://changas.invalid");
  } catch {
    return DEFAULT_ACTION_URL;
  }

  const allowed = SAFE_ACTION_ROOTS.some(
    (root) => parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
  );

  return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : DEFAULT_ACTION_URL;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildSafePushMessage(
  delivery: ClaimedDelivery,
): SafePushMessage {
  if (!delivery.endpoint || !delivery.p256dh || !delivery.authKey) {
    throw new Error("Push delivery is missing subscription material.");
  }

  return {
    deliveryId: delivery.deliveryId,
    endpoint: delivery.endpoint,
    p256dh: delivery.p256dh,
    authKey: delivery.authKey,
    title: "Changas",
    body: "Tenés una actualización importante.",
    actionUrl: sanitizeNotificationActionUrl(delivery.actionUrl),
  };
}

export function buildTransactionalEmail(
  delivery: ClaimedDelivery,
): TransactionalEmail | null {
  if (delivery.notificationKind === "MESSAGE" || !delivery.recipientEmail) {
    return null;
  }

  const actionUrl = sanitizeNotificationActionUrl(delivery.actionUrl);
  const subject = `${delivery.title} · Changas`;
  const safeTitle = escapeHtml(delivery.title);
  const safeBody = escapeHtml(delivery.body);
  const safeAction = escapeHtml(actionUrl);

  return {
    deliveryId: delivery.deliveryId,
    to: delivery.recipientEmail,
    subject,
    text: `${delivery.title}\n\n${delivery.body}\n\nAbrí Changas para revisar los detalles: ${actionUrl}`,
    html: `<h1>${safeTitle}</h1><p>${safeBody}</p><p><a href="${safeAction}">Abrir en Changas</a></p>`,
    actionUrl,
  };
}
