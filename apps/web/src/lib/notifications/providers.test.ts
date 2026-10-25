import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { sendNotificationMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
}));

vi.mock("web-push", () => ({
  sendNotification: sendNotificationMock,
}));

import { ResendEmailProvider, WebPushProvider } from "./providers";
import type { SafePushMessage, TransactionalEmail } from "./types";

const vapid = {
  publicKey: "public-key",
  privateKey: "private-key",
  subject: "mailto:notifications@changas.test",
};

const message: SafePushMessage = {
  deliveryId: "00000000-0000-4000-8000-000000000001",
  endpoint: "https://push.example.test/subscription",
  p256dh: "p256dh-key",
  authKey: "auth-key",
  title: "Nuevo mensaje",
  body: "Tenés un mensaje nuevo en YALO.",
  actionUrl: "/messages/abc",
};
const email: TransactionalEmail = {
  deliveryId: "00000000-0000-4000-8000-000000000002",
  to: "person@example.test",
  subject: "Tenés una actualización",
  text: "Abrí /jobs/abc",
  html: '<a href="/jobs/abc">Abrir</a>',
  actionUrl: "/jobs/abc",
};

describe("WebPushProvider", () => {
  it("sends the real title/body payload with VAPID details and a 300s TTL", async () => {
    sendNotificationMock.mockResolvedValueOnce({});
    const provider = new WebPushProvider(vapid);

    const result = await provider.send(message);

    expect(result).toEqual({ ok: true, retryable: false, errorCode: null });
    expect(sendNotificationMock).toHaveBeenCalledWith(
      {
        endpoint: message.endpoint,
        keys: { p256dh: message.p256dh, auth: message.authKey },
      },
      JSON.stringify({
        title: message.title,
        body: message.body,
        actionUrl: message.actionUrl,
      }),
      {
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        TTL: 300,
        timeout: 4_000,
      },
    );
  });

  it("maps gone subscriptions to a non-retryable purge signal", async () => {
    for (const statusCode of [404, 410]) {
      sendNotificationMock.mockRejectedValueOnce(
        Object.assign(new Error("subscription gone"), { statusCode }),
      );
      const provider = new WebPushProvider(vapid);

      const result = await provider.send(message);

      expect(result).toEqual({
        ok: false,
        retryable: false,
        errorCode: `HTTP_${statusCode}`,
      });
    }
  });

  it("retries a provider socket timeout", async () => {
    sendNotificationMock.mockRejectedValueOnce(new Error("Socket timeout"));
    const provider = new WebPushProvider(vapid);

    await expect(provider.send(message)).resolves.toEqual({
      ok: false,
      retryable: true,
      errorCode: "PUSH_NETWORK_ERROR",
    });
  });

  it("never calls web-push without VAPID configuration", async () => {
    sendNotificationMock.mockClear();
    const provider = new WebPushProvider({
      publicKey: undefined,
      privateKey: undefined,
      subject: undefined,
    });

    await expect(provider.send(message)).resolves.toEqual({
      ok: false,
      retryable: false,
      errorCode: "PUSH_PROVIDER_UNCONFIGURED",
    });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});

describe("ResendEmailProvider", () => {
  it("aborts and retries a slow provider request", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new Error("Request aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const provider = new ResendEmailProvider({
        apiKey: "test-key",
        from: "YALO <mail@example.test>",
        origin: "https://changas.test",
      });

      await expect(provider.send(email)).resolves.toEqual({
        ok: false,
        retryable: true,
        errorCode: "EMAIL_NETWORK_ERROR",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  }, 6_000);
});
