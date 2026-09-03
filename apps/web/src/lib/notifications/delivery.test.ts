import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildResendRequest,
  buildVapidAuthorization,
  classifyDeliveryHttpStatus,
  isAuthorizedDispatchRequest,
} from "./delivery";

function decodeBase64UrlJson(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

describe("notification delivery", () => {
  it("builds a short-lived VAPID token scoped to the push origin", () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const jwk = privateKey.export({ format: "jwk" });
    const publicKey = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x!, "base64url"),
      Buffer.from(jwk.y!, "base64url"),
    ]).toString("base64url");
    const nowSeconds = 1_800_000_000;

    const authorization = buildVapidAuthorization({
      endpoint: "https://push.example.test/subscription/123",
      publicKey,
      privateKey: jwk.d!,
      subject: "mailto:notifications@changas.test",
      nowSeconds,
    });

    expect(authorization).toMatch(/^vapid t=[^,]+, k=/);
    const jwt = authorization.match(/^vapid t=([^,]+),/)?.[1];
    expect(jwt).toBeTruthy();
    const [, payload] = jwt!.split(".");
    const claims = decodeBase64UrlJson(payload);

    expect(claims.aud).toBe("https://push.example.test");
    expect(claims.sub).toBe("mailto:notifications@changas.test");
    expect(claims.exp).toBe(nowSeconds + 12 * 60 * 60);
  });

  it("classifies retryable and permanent delivery responses", () => {
    expect(classifyDeliveryHttpStatus(201)).toEqual({
      ok: true,
      retryable: false,
      errorCode: null,
    });
    expect(classifyDeliveryHttpStatus(429).retryable).toBe(true);
    expect(classifyDeliveryHttpStatus(503).retryable).toBe(true);
    expect(classifyDeliveryHttpStatus(410)).toEqual({
      ok: false,
      retryable: false,
      errorCode: "HTTP_410",
    });
  });

  it("uses a bearer secret for the internal dispatcher", () => {
    expect(
      isAuthorizedDispatchRequest("Bearer phase08-secret", "phase08-secret"),
    ).toBe(true);
    expect(isAuthorizedDispatchRequest("Bearer wrong", "phase08-secret")).toBe(
      false,
    );
    expect(isAuthorizedDispatchRequest(null, "phase08-secret")).toBe(false);
  });

  it("builds a Resend request with an absolute first-party action link", () => {
    const request = buildResendRequest({
      apiKey: "re_test",
      from: "Changas <notificaciones@changas.test>",
      origin: "https://changas.test",
      email: {
        deliveryId: "00000000-0000-4000-8000-000000000001",
        to: "persona@example.test",
        subject: "Trabajo actualizado · Changas",
        text: "Hay una actualización importante.",
        html: '<p><a href="/jobs/abc">Abrir en Changas</a></p>',
        actionUrl: "/jobs/abc",
      },
    });

    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.init.headers).toMatchObject({
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    });
    const payload = JSON.parse(request.init.body as string) as Record<
      string,
      unknown
    >;
    expect(payload.to).toEqual(["persona@example.test"]);
    expect(payload.text).toContain("https://changas.test/jobs/abc");
  });
});
