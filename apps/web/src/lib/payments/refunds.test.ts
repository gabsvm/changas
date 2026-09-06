import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { encryptPaymentToken } from "./crypto";
import { createPaymentServer, PaymentServerError } from "./server";

const CLIENT_USER_ID = "73300000-0000-4000-8000-000000000001";
const PROVIDER_USER_ID = "73300000-0000-4000-8000-000000000002";
const PAYMENT_ATTEMPT_ID = "73310000-0000-4000-8000-000000000001";
const PAYMENT_ACCOUNT_ID = "73320000-0000-4000-8000-000000000001";
const REFUND_ID = "73330000-0000-4000-8000-000000000001";
const REFUND_NONCE = "73340000-0000-4000-8000-000000000001";
const TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");

const paymentEnv = {
  clientId: "phase11-client-id",
  clientSecret: "phase11-client-secret",
  webhookSecret: "phase11-webhook-secret",
  tokenEncryptionKey: TOKEN_KEY,
  tokenEncryptionKeyVersion: 1,
  oauthStateSecret: Buffer.alloc(32, 9).toString("base64"),
  marketplaceFeeBps: 1000,
  providerMode: "test" as const,
};

function makeRefundServer(overrides: {
  currentUserId?: string | null;
  refundableRemainingMinor?: number;
  existingRefund?: Record<string, unknown> | null;
  providerFailure?: Error;
} = {}) {
  const accessToken = encryptPaymentToken(
    "APP_USR-seller-refund-access",
    TOKEN_KEY,
    1,
  );
  const created: unknown[] = [];
  const recorded: unknown[] = [];
  const refund = vi.fn(async (input: unknown) => {
    if (overrides.providerFailure) throw overrides.providerFailure;
    return {
      providerRefundReference: "refund-mp-001",
      providerPaymentReference: "payment-mp-001",
      amountMinor: (input as { amountMinor: number }).amountMinor,
      rawStatus: "approved",
    };
  });

  const dependencies = {
    now: () => Date.UTC(2026, 8, 6, 3, 0, 0),
    siteUrl: "https://changas.test",
    paymentEnv,
    getCurrentUser: async () => {
      const id =
        overrides.currentUserId === undefined
          ? CLIENT_USER_ID
          : overrides.currentUserId;
      return id ? { id } : null;
    },
    hasProviderProfile: async () => false,
    getAccountState: async () => null,
    upsertAccount: async () => undefined,
    loadPaymentRefundSnapshot: async () => ({
      paymentAttemptId: PAYMENT_ATTEMPT_ID,
      clientUserId: CLIENT_USER_ID,
      providerUserId: PROVIDER_USER_ID,
      paymentProviderAccountId: PAYMENT_ACCOUNT_ID,
      providerName: "MERCADO_PAGO",
      providerPaymentReference: "payment-mp-001",
      amountMinor: 100000,
      refundableRemainingMinor: overrides.refundableRemainingMinor ?? 100000,
      currencyCode: "ARS",
      paymentStatus: "SUCCEEDED",
      providerAccountReference: "seller-phase11-001",
      accessToken,
      encryptionKeyVersion: 1,
    }),
    findRefundByNonce: async () => overrides.existingRefund ?? null,
    createRefundRecord: async (input: unknown) => {
      created.push(input);
      return {
        ...(input as Record<string, unknown>),
        id: REFUND_ID,
        status: "REQUESTED",
        providerRefundReference: null,
      };
    },
    markRefundProviderResult: async (input: unknown) => {
      recorded.push(input);
    },
    paymentProvider: {
      exchangeOAuthCode: async () => {
        throw new Error("not used");
      },
      refund,
    },
  };

  const server = createPaymentServer(
    dependencies as unknown as Parameters<typeof createPaymentServer>[0],
  );
  return { server, refund, created, recorded };
}

async function expectPaymentError(operation: () => Promise<unknown>, code: string) {
  const error = await operation().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PaymentServerError);
  expect(error).toMatchObject({ code });
}

describe("Phase 11 refund orchestration", () => {
  it("derives a full refund from durable refundable balance and calls Mercado Pago idempotently", async () => {
    const { server, refund, created, recorded } = makeRefundServer();

    const result = await server.requestPaymentRefund(
      PAYMENT_ATTEMPT_ID,
      REFUND_NONCE,
    );

    expect(created[0]).toMatchObject({
      paymentAttemptId: PAYMENT_ATTEMPT_ID,
      requestNonce: REFUND_NONCE,
      amountMinor: 100000,
      currencyCode: "ARS",
      status: "REQUESTED",
    });
    expect(refund).toHaveBeenCalledWith({
      accessToken: "APP_USR-seller-refund-access",
      paymentId: "payment-mp-001",
      idempotencyKey: REFUND_NONCE,
      amountMinor: 100000,
    });
    expect(recorded[0]).toMatchObject({
      refundId: REFUND_ID,
      providerRefundReference: "refund-mp-001",
      status: "PENDING",
    });
    expect(result).toMatchObject({
      refundId: REFUND_ID,
      amountMinor: 100000,
      status: "PENDING",
    });
  });

  it("supports a partial refund but never exceeds the remaining durable refundable amount", async () => {
    const { server, refund } = makeRefundServer({
      refundableRemainingMinor: 75000,
    });

    await server.requestPaymentRefund(PAYMENT_ATTEMPT_ID, REFUND_NONCE, 25000);
    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 25000 }),
    );

    const tooLarge = makeRefundServer({ refundableRemainingMinor: 20000 });
    await expectPaymentError(
      () =>
        tooLarge.server.requestPaymentRefund(
          PAYMENT_ATTEMPT_ID,
          REFUND_NONCE,
          25000,
        ),
      "CONFLICT",
    );
    expect(tooLarge.refund).not.toHaveBeenCalled();
  });

  it("replays an existing refund nonce without calling Mercado Pago twice", async () => {
    const existing = {
      id: REFUND_ID,
      paymentAttemptId: PAYMENT_ATTEMPT_ID,
      requestNonce: REFUND_NONCE,
      providerName: "MERCADO_PAGO",
      providerPaymentReference: "payment-mp-001",
      providerRefundReference: "refund-mp-001",
      amountMinor: 25000,
      currencyCode: "ARS",
      status: "PENDING",
    };
    const { server, refund, created } = makeRefundServer({
      existingRefund: existing,
    });

    expect(
      await server.requestPaymentRefund(
        PAYMENT_ATTEMPT_ID,
        REFUND_NONCE,
        25000,
      ),
    ).toMatchObject({
      refundId: REFUND_ID,
      amountMinor: 25000,
      status: "PENDING",
    });
    expect(created).toHaveLength(0);
    expect(refund).not.toHaveBeenCalled();
  });

  it("records provider rejection without ever reporting refund success", async () => {
    const { server, recorded } = makeRefundServer({
      providerFailure: new Error("insufficient seller balance"),
    });

    await expectPaymentError(
      () => server.requestPaymentRefund(PAYMENT_ATTEMPT_ID, REFUND_NONCE),
      "PROVIDER_UNAVAILABLE",
    );
    expect(recorded[0]).toMatchObject({
      refundId: REFUND_ID,
      status: "FAILED",
      reasonCode: "REFUND_REJECTED",
    });
  });
});
