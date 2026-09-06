import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { encryptPaymentToken } from "./crypto";
import { createPaymentRefundServer } from "./server-refunds";
import { PaymentServerError } from "./server";

const CLIENT_USER_ID = "73300000-0000-4000-8000-000000000001";
const PROVIDER_USER_ID = "73300000-0000-4000-8000-000000000002";
const PAYMENT_ATTEMPT_ID = "73310000-0000-4000-8000-000000000001";
const PAYMENT_ACCOUNT_ID = "73320000-0000-4000-8000-000000000001";
const REFUND_ID = "73330000-0000-4000-8000-000000000001";
const REFUND_NONCE = "73340000-0000-4000-8000-000000000001";
const RUN_ID = "73350000-0000-4000-8000-000000000001";
const TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");

function makeRefundServer(
  overrides: {
    currentUserId?: string | null;
    refundableRemainingMinor?: number;
    existingRefund?: Record<string, unknown> | null;
    providerFailure?: Error;
  } = {},
) {
  const accessToken = encryptPaymentToken(
    "APP_USR-seller-refund-access",
    TOKEN_KEY,
    1,
  );
  const created: unknown[] = [];
  const recorded: unknown[] = [];
  const finishedRuns: unknown[] = [];
  const refund = vi.fn(async (input: unknown) => {
    if (overrides.providerFailure) throw overrides.providerFailure;
    return {
      providerRefundReference: "refund-mp-001",
      providerPaymentReference: "payment-mp-001",
      amountMinor: (input as { amountMinor: number }).amountMinor,
      rawStatus: "approved",
    };
  });

  let durableRefund: Record<string, unknown> | null =
    overrides.existingRefund ?? null;

  const dependencies = {
    paymentEnv: { tokenEncryptionKey: TOKEN_KEY },
    getCurrentUser: async () => {
      const id =
        overrides.currentUserId === undefined
          ? CLIENT_USER_ID
          : overrides.currentUserId;
      return id ? { id } : null;
    },
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
    findRefundByNonce: async () => durableRefund,
    createRefundRecord: async (input: unknown) => {
      created.push(input);
      durableRefund = {
        ...(input as Record<string, unknown>),
        id: REFUND_ID,
        providerName: "MERCADO_PAGO",
        providerPaymentReference: "payment-mp-001",
        providerRefundReference: null,
        reasonCode: null,
      };
      return durableRefund;
    },
    markRefundProviderResult: async (input: unknown) => {
      recorded.push(input);
      const update = input as {
        refundId: string;
        providerRefundReference: string | null;
        status: string;
        reasonCode?: string | null;
      };
      durableRefund = {
        ...(durableRefund ?? {
          id: update.refundId,
          paymentAttemptId: PAYMENT_ATTEMPT_ID,
          requestNonce: REFUND_NONCE,
          providerName: "MERCADO_PAGO",
          providerPaymentReference: "payment-mp-001",
          amountMinor: 100000,
          currencyCode: "ARS",
        }),
        providerRefundReference: update.providerRefundReference,
        status: update.status,
        reasonCode: update.reasonCode ?? null,
      };
      return durableRefund;
    },
    startReconciliationRun: async () => RUN_ID,
    finishReconciliationRun: async (input: unknown) => {
      finishedRuns.push(input);
    },
    performReconciliation: async () => ({
      checkedCount: 3,
      matchedCount: 2,
      mismatchedCount: 1,
      failedCount: 0,
    }),
    paymentProvider: { refund },
  };

  const server = createPaymentRefundServer(dependencies);
  return { server, refund, created, recorded, finishedRuns };
}

async function expectPaymentError(operation: () => Promise<unknown>, code: string) {
  const error = await operation().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PaymentServerError);
  expect(error).toMatchObject({ code });
}

describe("Phase 11 refund orchestration", () => {
  it("derives a full refund from durable refundable balance and keeps it pending after provider acknowledgement", async () => {
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

  it("replays an existing non-requested refund nonce without calling Mercado Pago twice", async () => {
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
      reasonCode: null,
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

  it("only marks refund success through the explicit reconciliation boundary", async () => {
    const { server } = makeRefundServer();
    await server.requestPaymentRefund(PAYMENT_ATTEMPT_ID, REFUND_NONCE, 25000);

    const reconciled = await server.reconcileRefund(REFUND_ID, {
      status: "SUCCEEDED",
      providerRefundReference: "refund-mp-001",
      providerEventId: "73360000-0000-4000-8000-000000000001",
    });

    expect(reconciled).toMatchObject({
      refundId: REFUND_ID,
      amountMinor: 25000,
      status: "SUCCEEDED",
      providerRefundReference: "refund-mp-001",
    });
  });

  it("records reconciliation-run counters once the scan finishes", async () => {
    const { server, finishedRuns } = makeRefundServer();

    expect(await server.runPaymentReconciliation()).toEqual({
      runId: RUN_ID,
      checkedCount: 3,
      matchedCount: 2,
      mismatchedCount: 1,
      failedCount: 0,
    });
    expect(finishedRuns).toEqual([
      {
        runId: RUN_ID,
        checkedCount: 3,
        matchedCount: 2,
        mismatchedCount: 1,
        failedCount: 0,
      },
    ]);
  });
});
