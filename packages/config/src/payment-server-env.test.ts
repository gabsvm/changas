import { describe, expect, it } from "vitest";

import { parsePaymentServerEnv } from "./payment-server-env";

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const OAUTH_STATE_SECRET = Buffer.alloc(32, 9).toString("base64");

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    MERCADO_PAGO_CLIENT_ID: "test-client-id",
    MERCADO_PAGO_CLIENT_SECRET: "test-client-secret",
    MERCADO_PAGO_WEBHOOK_SECRET: "test-webhook-secret",
    PAYMENT_TOKEN_ENCRYPTION_KEY_V1: ENCRYPTION_KEY,
    PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION: "1",
    PAYMENT_OAUTH_STATE_SECRET: OAUTH_STATE_SECRET,
    CHANGAS_MARKETPLACE_FEE_BPS: "1000",
    MERCADO_PAGO_MODE: "test",
    ...overrides,
  };
}

describe("Phase 11 payment server environment", () => {
  it("parses a complete test-mode configuration", () => {
    expect(parsePaymentServerEnv(validEnv())).toEqual({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      webhookSecret: "test-webhook-secret",
      tokenEncryptionKey: ENCRYPTION_KEY,
      tokenEncryptionKeyVersion: 1,
      oauthStateSecret: OAUTH_STATE_SECRET,
      marketplaceFeeBps: 1000,
      providerMode: "test",
    });
  });

  it.each([
    "MERCADO_PAGO_CLIENT_ID",
    "MERCADO_PAGO_CLIENT_SECRET",
    "MERCADO_PAGO_WEBHOOK_SECRET",
    "PAYMENT_TOKEN_ENCRYPTION_KEY_V1",
    "PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION",
    "PAYMENT_OAUTH_STATE_SECRET",
    "CHANGAS_MARKETPLACE_FEE_BPS",
    "MERCADO_PAGO_MODE",
  ])("rejects missing %s", (name) => {
    expect(() => parsePaymentServerEnv(validEnv({ [name]: undefined }))).toThrow();
  });

  it("requires the token encryption key to decode to exactly 32 bytes", () => {
    expect(() =>
      parsePaymentServerEnv(
        validEnv({ PAYMENT_TOKEN_ENCRYPTION_KEY_V1: "not-base64!!!" }),
      ),
    ).toThrow();
    expect(() =>
      parsePaymentServerEnv(
        validEnv({
          PAYMENT_TOKEN_ENCRYPTION_KEY_V1: Buffer.alloc(31).toString("base64"),
        }),
      ),
    ).toThrow();
    expect(() =>
      parsePaymentServerEnv(
        validEnv({
          PAYMENT_TOKEN_ENCRYPTION_KEY_V1: Buffer.alloc(33).toString("base64"),
        }),
      ),
    ).toThrow();
  });

  it("requires an independent OAuth state secret with at least 32 decoded bytes", () => {
    expect(() =>
      parsePaymentServerEnv(
        validEnv({ PAYMENT_OAUTH_STATE_SECRET: Buffer.alloc(31).toString("base64") }),
      ),
    ).toThrow();
    expect(() =>
      parsePaymentServerEnv(validEnv({ PAYMENT_OAUTH_STATE_SECRET: "not-base64!!!" })),
    ).toThrow();
  });

  it.each(["-1", "10001", "100.5", "NaN"])(
    "rejects invalid marketplace fee basis points %s",
    (marketplaceFeeBps) => {
      expect(() =>
        parsePaymentServerEnv(
          validEnv({ CHANGAS_MARKETPLACE_FEE_BPS: marketplaceFeeBps }),
        ),
      ).toThrow();
    },
  );

  it.each(["0", "-1", "1.5", "NaN"])(
    "rejects invalid encryption key version %s",
    (version) => {
      expect(() =>
        parsePaymentServerEnv(
          validEnv({ PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION: version }),
        ),
      ).toThrow();
    },
  );

  it("accepts live mode syntactically but rejects unknown provider modes", () => {
    expect(parsePaymentServerEnv(validEnv({ MERCADO_PAGO_MODE: "live" })).providerMode).toBe(
      "live",
    );
    expect(() =>
      parsePaymentServerEnv(validEnv({ MERCADO_PAGO_MODE: "sandbox" })),
    ).toThrow();
  });
});
