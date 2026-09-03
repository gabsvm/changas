import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deletePushSubscription,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  upsertPushSubscription,
} from "./server";

function rpcClient(
  handler: (name: string, args?: Record<string, unknown>) => unknown,
) {
  return {
    rpc: vi.fn().mockImplementation(async (name, args) => ({
      data: handler(name, args),
      error: null,
    })),
  };
}

describe("Phase 08 notification server boundary", () => {
  it("loads notification center rows through the owner-safe RPC and sanitizes actions", async () => {
    const client = rpcClient(() => [
      {
        notification_id: "11111111-1111-4111-8111-111111111111",
        kind: "JOB",
        title: "Trabajo actualizado",
        body: "Hay una actualización importante.",
        action_url: "https://evil.example/jobs/1",
        entity_type: "job",
        entity_id: "22222222-2222-4222-8222-222222222222",
        created_at: "2026-09-03T03:00:00.000Z",
        read_at: null,
      },
    ]);

    await expect(listNotifications(client as never)).resolves.toEqual([
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        kind: "JOB",
        unread: true,
        actionUrl: "/account/notifications",
      }),
    ]);
    expect(client.rpc).toHaveBeenCalledWith("list_my_notifications", {
      page_size: 30,
      before_created_at: null,
      before_id: null,
    });
  });

  it("reads unread count and preferences without direct table writes", async () => {
    const client = rpcClient((name) => {
      if (name === "get_my_notification_unread_count") return 3;
      return [
        {
          push_actionable_enabled: false,
          email_important_enabled: true,
          job_reminders_enabled: true,
          proposal_alerts_enabled: true,
          verification_alerts_enabled: true,
          promotional_enabled: false,
          updated_at: "2026-09-03T03:00:00.000Z",
        },
      ];
    });

    await expect(getUnreadNotificationCount(client as never)).resolves.toBe(3);
    await expect(
      getNotificationPreferences(client as never),
    ).resolves.toMatchObject({
      pushActionableEnabled: false,
      emailImportantEnabled: true,
      promotionalEnabled: false,
    });
  });

  it("marks one and all notifications read through dedicated RPCs", async () => {
    const client = rpcClient((name) => {
      if (name === "mark_notification_read") return true;
      if (name === "mark_all_notifications_read") return 4;
      return null;
    });
    const notificationId = "11111111-1111-4111-8111-111111111111";

    await expect(
      markNotificationRead(client as never, notificationId),
    ).resolves.toBe(true);
    await expect(markAllNotificationsRead(client as never)).resolves.toBe(4);
    expect(client.rpc).toHaveBeenNthCalledWith(1, "mark_notification_read", {
      target_notification_id: notificationId,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(
      2,
      "mark_all_notifications_read",
    );
  });

  it("updates all preference flags through the dedicated RPC", async () => {
    const client = rpcClient(() => [
      {
        push_actionable_enabled: true,
        email_important_enabled: true,
        job_reminders_enabled: false,
        proposal_alerts_enabled: true,
        verification_alerts_enabled: false,
        promotional_enabled: false,
        updated_at: "2026-09-03T03:00:00.000Z",
      },
    ]);

    await updateNotificationPreferences(client as never, {
      pushActionableEnabled: true,
      emailImportantEnabled: true,
      jobRemindersEnabled: false,
      proposalAlertsEnabled: true,
      verificationAlertsEnabled: false,
      promotionalEnabled: false,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "update_my_notification_preferences",
      {
        requested_push_actionable_enabled: true,
        requested_email_important_enabled: true,
        requested_job_reminders_enabled: false,
        requested_proposal_alerts_enabled: true,
        requested_verification_alerts_enabled: false,
        requested_promotional_enabled: false,
      },
    );
  });

  it("persists and removes browser push subscriptions only through RPCs", async () => {
    const client = rpcClient((name) => {
      if (name === "upsert_push_subscription") {
        return "33333333-3333-4333-8333-333333333333";
      }
      if (name === "delete_push_subscription") return true;
      return null;
    });

    await expect(
      upsertPushSubscription(client as never, {
        endpoint: "https://push.example.test/subscription/123",
        p256dh: "p256dh-key",
        auth: "auth-key",
        userAgent: "test-browser",
      }),
    ).resolves.toBe("33333333-3333-4333-8333-333333333333");
    await expect(
      deletePushSubscription(
        client as never,
        "https://push.example.test/subscription/123",
      ),
    ).resolves.toBe(true);

    expect(client.rpc).toHaveBeenNthCalledWith(1, "upsert_push_subscription", {
      subscription_endpoint: "https://push.example.test/subscription/123",
      subscription_p256dh: "p256dh-key",
      subscription_auth: "auth-key",
      subscription_user_agent: "test-browser",
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, "delete_push_subscription", {
      subscription_endpoint: "https://push.example.test/subscription/123",
    });
  });

  it("does not surface raw database errors", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "postgres secret details" },
      }),
    };

    await expect(listNotifications(client as never)).rejects.toThrow(
      "No pudimos cargar tus notificaciones.",
    );
  });
});
