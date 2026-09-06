import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createPaymentAdminServer,
  createPaymentReceiptServer,
  PaymentServerError,
} from "./server";

const ADMIN_USER_ID = "81100000-0000-4000-8000-000000000001";
const CLIENT_USER_ID = "81100000-0000-4000-8000-000000000002";
const PROVIDER_USER_ID = "81100000-0000-4000-8000-000000000003";
const OUTSIDER_USER_ID = "81100000-0000-4000-8000-000000000004";
const PAYMENT_ATTEMPT_ID = "81110000-0000-4000-8000-000000000001";

async function expectPaymentError(
  operation: () => Promise<unknown>,
  code: string,
) {
  const error = await operation().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PaymentServerError);
  expect(error).toMatchObject({ code });
}

function makeAdminServer(
  overrides: {
    currentUserId?: string | null;
    admin?: boolean;
  } = {},
) {
  const runReconciliation = vi.fn(async () => ({
    runId: "81120000-0000-4000-8000-000000000001",
    checkedCount: 3,
    matchedCount: 2,
    mismatchedCount: 1,
    failedCount: 0,
  }));

  const server = createPaymentAdminServer({
    getCurrentUser: async () => {
      const id =
        overrides.currentUserId === undefined
          ? ADMIN_USER_ID
          : overrides.currentUserId;
      return id ? { id } : null;
    },
    isAdmin: async () => overrides.admin ?? true,
    listPaymentRows: async () => [
      {
        paymentAttemptId: PAYMENT_ATTEMPT_ID,
        proposalId: "81130000-0000-4000-8000-000000000001",
        clientUserId: CLIENT_USER_ID,
        providerUserId: PROVIDER_USER_ID,
        providerName: "MERCADO_PAGO",
        providerReference: "payment-admin-001",
        localStatus: "SUCCEEDED",
        providerStatus: "REFUNDED",
        grossMinor: 100000,
        marketplaceFeeMinor: 10000,
        providerExpectedNetMinor: 90000,
        providerFeeMinor: 3500,
        providerNetReceivedMinor: 86500,
        settlementStatus: "AVAILABLE",
        refundStatus: "SUCCEEDED",
        refundedMinor: 25000,
        mismatchFlag: true,
        lastReconciledAt: "2026-09-06T03:00:00.000Z",
        accessToken: "must-never-leak",
        refreshToken: "must-never-leak",
        ciphertext: "must-never-leak",
      },
    ],
    listReconciliationRuns: async () => [
      {
        runId: "81120000-0000-4000-8000-000000000001",
        initiatorType: "ADMIN",
        providerName: "MERCADO_PAGO",
        checkedCount: 3,
        matchedCount: 2,
        mismatchedCount: 1,
        failedCount: 0,
        status: "COMPLETED",
        startedAt: "2026-09-06T02:59:00.000Z",
        finishedAt: "2026-09-06T03:00:00.000Z",
        errorSummary: null,
      },
    ],
    runReconciliation,
  });

  return { server, runReconciliation };
}

describe("Phase 11 admin payment visibility", () => {
  it("denies unauthenticated and non-admin callers before reading financial data", async () => {
    const anonymous = makeAdminServer({ currentUserId: null });
    await expectPaymentError(
      () => anonymous.server.listAdminPayments(),
      "UNAUTHORIZED",
    );

    const member = makeAdminServer({ admin: false });
    await expectPaymentError(() => member.server.listAdminPayments(), "FORBIDDEN");
    expect(member.runReconciliation).not.toHaveBeenCalled();
  });

  it("returns safe financial fields including provider mismatch visibility without credential leakage", async () => {
    const { server } = makeAdminServer();

    const result = await server.listAdminPayments();

    expect(result.payments).toEqual([
      {
        paymentAttemptId: PAYMENT_ATTEMPT_ID,
        proposalId: "81130000-0000-4000-8000-000000000001",
        clientUserId: CLIENT_USER_ID,
        providerUserId: PROVIDER_USER_ID,
        providerName: "MERCADO_PAGO",
        providerReference: "payment-admin-001",
        localStatus: "SUCCEEDED",
        providerStatus: "REFUNDED",
        grossMinor: 100000,
        marketplaceFeeMinor: 10000,
        providerExpectedNetMinor: 90000,
        providerFeeMinor: 3500,
        providerNetReceivedMinor: 86500,
        settlementStatus: "AVAILABLE",
        refundStatus: "SUCCEEDED",
        refundedMinor: 25000,
        mismatchFlag: true,
        lastReconciledAt: "2026-09-06T03:00:00.000Z",
      },
    ]);
    expect(result.runs).toHaveLength(1);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("must-never-leak");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("refreshToken");
    expect(serialized).not.toContain("ciphertext");
  });

  it("runs reconciliation only as an authenticated admin and binds the audit run to that admin", async () => {
    const { server, runReconciliation } = makeAdminServer();

    const result = await server.runAdminPaymentReconciliation();

    expect(runReconciliation).toHaveBeenCalledWith({
      initiatedByUserId: ADMIN_USER_ID,
      initiatorType: "ADMIN",
      providerName: "MERCADO_PAGO",
    });
    expect(result).toMatchObject({
      checkedCount: 3,
      matchedCount: 2,
      mismatchedCount: 1,
      failedCount: 0,
    });

    const member = makeAdminServer({ admin: false });
    await expectPaymentError(
      () => member.server.runAdminPaymentReconciliation(),
      "FORBIDDEN",
    );
    expect(member.runReconciliation).not.toHaveBeenCalled();
  });
});

function makeReceiptServer(currentUserId: string | null) {
  return createPaymentReceiptServer({
    getCurrentUser: async () => (currentUserId ? { id: currentUserId } : null),
    loadPaymentReceipt: async () => ({
      paymentAttemptId: PAYMENT_ATTEMPT_ID,
      clientUserId: CLIENT_USER_ID,
      providerUserId: PROVIDER_USER_ID,
      providerName: "MERCADO_PAGO",
      providerReference: "payment-admin-001",
      externalReference: "changas:checkout:receipt-001",
      amountMinor: 100000,
      currencyCode: "ARS",
      status: "SUCCEEDED",
      refundedMinor: 25000,
      createdAt: "2026-09-06T02:00:00.000Z",
      accessTokenCiphertext: "must-never-leak",
    }),
  });
}

describe("Phase 11 participant-safe payment receipt", () => {
  it("allows the payment client or provider to read only safe receipt/reference fields", async () => {
    for (const userId of [CLIENT_USER_ID, PROVIDER_USER_ID]) {
      const server = makeReceiptServer(userId);
      const receipt = await server.getMyPaymentReceipt(PAYMENT_ATTEMPT_ID);

      expect(receipt).toEqual({
        paymentAttemptId: PAYMENT_ATTEMPT_ID,
        providerName: "MERCADO_PAGO",
        providerReference: "payment-admin-001",
        externalReference: "changas:checkout:receipt-001",
        amountMinor: 100000,
        currencyCode: "ARS",
        status: "SUCCEEDED",
        refundedMinor: 25000,
        createdAt: "2026-09-06T02:00:00.000Z",
      });
      expect(JSON.stringify(receipt)).not.toContain("must-never-leak");
    }
  });

  it("denies anonymous and unrelated authenticated users", async () => {
    await expectPaymentError(
      () => makeReceiptServer(null).getMyPaymentReceipt(PAYMENT_ATTEMPT_ID),
      "UNAUTHORIZED",
    );
    await expectPaymentError(
      () =>
        makeReceiptServer(OUTSIDER_USER_ID).getMyPaymentReceipt(
          PAYMENT_ATTEMPT_ID,
        ),
      "FORBIDDEN",
    );
  });
});
