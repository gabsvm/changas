import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { MercadoPagoPaymentProvider } from "./mercado-pago";

const WEBHOOK_SECRET = "phase11-webhook-secret";

function createProvider() {
  return new MercadoPagoPaymentProvider({
    clientId: "phase11-client-id",
    clientSecret: "phase11-client-secret",
    webhookSecret: WEBHOOK_SECRET,
    fetchImpl: async () => {
      throw new Error("webhook verification must not perform network I/O");
    },
  });
}

function signFor(dataId: string, requestId: string, tsSeconds: number): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${tsSeconds};`;
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(manifest).digest("hex");
  return `ts=${tsSeconds},v1=${v1}`;
}

describe("webhook anti-replay (|now-ts| <= 10min)", () => {
  it("acepta una firma fresca dentro de la ventana", () => {
    const nowMs = 1_800_000_000_000;
    const ts = Math.floor(nowMs / 1000) - 60;
    const provider = createProvider();

    expect(
      provider.verifyWebhook(
        {
          xSignature: signFor("123456789", "request-abc-123", ts),
          xRequestId: "request-abc-123",
          dataId: "123456789",
        },
        { nowMs },
      ),
    ).toBe(true);
  });

  it("rechaza firmas viejas y futuras fuera de la ventana", () => {
    const nowMs = 1_800_000_000_000;
    const provider = createProvider();
    const oldTs = Math.floor(nowMs / 1000) - 11 * 60;
    const futureTs = Math.floor(nowMs / 1000) + 11 * 60;

    expect(
      provider.verifyWebhook(
        {
          xSignature: signFor("123456789", "request-abc-123", oldTs),
          xRequestId: "request-abc-123",
          dataId: "123456789",
        },
        { nowMs },
      ),
    ).toBe(false);
    expect(
      provider.verifyWebhook(
        {
          xSignature: signFor("123456789", "request-abc-123", futureTs),
          xRequestId: "request-abc-123",
          dataId: "123456789",
        },
        { nowMs },
      ),
    ).toBe(false);
  });

  it("rechaza ts no numérico cuando se exige la ventana", () => {
    const provider = createProvider();
    expect(
      provider.verifyWebhook(
        {
          xSignature: "ts=not-a-number,v1=" + "a".repeat(64),
          xRequestId: "request-abc-123",
          dataId: "123456789",
        },
        { nowMs: 1_800_000_000_000 },
      ),
    ).toBe(false);
  });
});
