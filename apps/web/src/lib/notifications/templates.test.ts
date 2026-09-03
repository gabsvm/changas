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
    expect(
      sanitizeNotificationActionUrl("https://evil.example/jobs/abc"),
    ).toBe("/account/notifications");
    expect(sanitizeNotificationActionUrl("/admin")).toBe(
      "/account/notifications",
    );
  });

  it("keeps lock-screen push copy generic even when the stored center copy is specific", () => {
    const push = buildSafePushMessage({
      ...baseDelivery,
      channel: "PUSH",
      body: "PRIVATE CHAT BODY SHOULD NEVER LEAK",
      endpoint: "https://push.example.test/subscription",
      p256dh: "key",
      authKey: "auth",
    });

    expect(push.title).toBe("Changas");
    expect(push.body).toBe("Tenés una actualización importante.");
    expect(push.body).not.toContain("PRIVATE");
    expect(push.actionUrl).toBe(baseDelivery.actionUrl);
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
