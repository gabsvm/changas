import { describe, expect, it } from "vitest";

import {
  buildSafePushMessage,
  buildTransactionalEmail,
  sanitizeNotificationActionUrl,
} from "./templates";
import type { ClaimedDelivery } from "./types";

const baseDelivery: ClaimedDelivery = {
  deliveryId: "00000000-0000-4000-8000-000000000001",
  notificationId: "00000000-0000-4000-8000-000000000002",
  channel: "EMAIL",
  recipientUserId: "00000000-0000-4000-8000-000000000003",
  notificationKind: "JOB",
  title: "Trabajo actualizado",
  body: "Hay una actualización importante en uno de tus trabajos.",
  actionUrl: "/jobs/00000000-0000-4000-8000-000000000004",
  sourceEventType: "JOB_STATUS_CHANGED:COMPLETED",
  endpoint: null,
  p256dh: null,
  authKey: null,
  recipientEmail: "persona@example.test",
  leaseToken: "00000000-0000-4000-8000-000000000005",
};

describe("notification templates", () => {
  it("allows only first-party notification destinations", () => {
    expect(sanitizeNotificationActionUrl("/jobs/abc?tab=activity")).toBe(
      "/jobs/abc?tab=activity",
    );
    expect(sanitizeNotificationActionUrl("/messages/abc")).toBe(
      "/messages/abc",
    );
    expect(sanitizeNotificationActionUrl("https://evil.example/jobs/abc")).toBe(
      "/account/notifications",
    );
    expect(sanitizeNotificationActionUrl("/admin")).toBe(
      "/account/notifications",
    );
  });

  it("carries the real delivery title and body into the push payload", () => {
    const push = buildSafePushMessage({
      ...baseDelivery,
      channel: "PUSH",
      title: "Propuesta aceptada",
      body: "Una propuesta fue aceptada.",
      endpoint: "https://push.example.test/subscription",
      p256dh: "key",
      authKey: "auth",
    });

    expect(push.title).toBe("Propuesta aceptada");
    expect(push.body).toBe("Una propuesta fue aceptada.");
    expect(push.actionUrl).toBe(baseDelivery.actionUrl);
  });

  it("caps push copy for lock-screen display", () => {
    const push = buildSafePushMessage({
      ...baseDelivery,
      channel: "PUSH",
      title: `Título ${"muy largo ".repeat(10)}`,
      body: `Cuerpo ${"con detalle ".repeat(20)}`,
      endpoint: "https://push.example.test/subscription",
      p256dh: "key",
      authKey: "auth",
    });

    expect(push.title.length).toBeLessThanOrEqual(60);
    expect(push.body.length).toBeLessThanOrEqual(140);
    expect(push.title.startsWith("Título muy largo")).toBe(true);
    expect(push.body.startsWith("Cuerpo con detalle")).toBe(true);
  });

  it("never creates transactional email for ordinary chat messages", () => {
    expect(
      buildTransactionalEmail({
        ...baseDelivery,
        notificationKind: "MESSAGE",
      }),
    ).toBeNull();
  });

  it("creates important-event email only from safe stored notification copy", () => {
    const email = buildTransactionalEmail(baseDelivery);

    expect(email?.to).toBe("persona@example.test");
    expect(email?.subject).toBe("Trabajo actualizado · Changas");
    expect(email?.text).toContain(baseDelivery.body);
    expect(email?.actionUrl).toBe(baseDelivery.actionUrl);
  });
});
