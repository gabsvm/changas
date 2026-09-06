import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { encryptPaymentToken } from "./crypto";
import { createPaymentServer, PaymentServerError } from "./server";

const TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
const STATE_SECRET = Buffer.alloc(32, 9).toString("base64");
const CLIENT_USER_ID = "72200000-0000-4000-8000-000000000001";
const PROVIDER_USER_ID = "72200000-0000-4000-8000-000000000002";
const PAYMENT_ACCOUNT_ID = "72210000-0000-4000-8000-000000000001";
const CHECKOUT_ID = "72220000-0000-4000-8000-000000000001";
const EVENT_ID = "72230000-0000-4000-8000-000000000001";
const PAYMENT_ID = "987654321";
const EXTERNAL_REFERENCE = "changas:checkout:72240000-0000-4000-8000-000000000001";

const paymentEnv = {
  clientId: "phase11-client-id",
  clientSecret: "phase11-client-secret",
  webhookSecret: "phase11-webhook-secret",
  tokenEncryptionKey: TOKEN_KEY,
  tokenEncryptionKeyVersion: 1,
  oauthStateSecret: STATE_SECRET,
  marketplaceFeeBps: 1000,
  providerMode: "test" as const,
};

const rawBody = JSON.stringify({
  id: 445566,
  live_mode: false,
  type: "payment",
  action: "payment.updated",
  user_id: 123456,
  data: { id: PAYMENT_ID },
  status: "approved",
});

type WebhookInput = {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  rawBody: string;
};

type WebhookCapableServer = ReturnType<typeof createPaymentServer> & {
  processMercadoPagoWebhook(input: WebhookInput): Promise<{
    processed: boolean;
    duplicate: boolean;
  }>;
};

function makeWebhookServer(
  overrides: {
    signatureValid?: boolean;
    eventProcessingStatus?: "RECEIVED" | "PROCESSED" | "FAILED";
    payment?: Record<string, unknown>;
    checkout?: Record<string, unknown>;
    seller?: Record<string, unknown> | null;
  } = {},
) {
  const verifyWebhook = vi.fn(() => overrides.signatureValid ?? true);
  const fetchPayment = vi.fn(async () =>
    overrides.payment ?? {
      providerPaymentReference: PAYMENT_ID,
      status: "SUCCEEDED",
      rawStatus: "approved",
      statusDetail: "accredited",
      amountMinor: 125000,
      refundedAmountMinor: 0,
      currencyCode: "ARS",
      providerAccountReference: "123456",
      externalReference: EXTERNAL_REFERENCE,
      providerNetReceivedMinor: 112500,
    },
  );
  const accessToken = encryptPaymentToken(
    "APP_USR-seller-webhook-token",
    TOKEN_KEY,
    1,
  );
  const loadProviderAccountByReference = vi.fn(async () =>
    overrides.seller === undefined
      ? {
          id: PAYMENT_ACCOUNT_ID,
          providerUserId: PROVIDER_USER_ID,
          providerName: "MERCADO_PAGO",
          providerAccountReference: "123456",
          status: "CONNECTED",
          accessToken,
          encryptionKeyVersion: 1,
        }
      : overrides.seller,
  );
  const findCheckoutByExternalReference = vi.fn(async () =>
    overrides.checkout ?? {
      id: CHECKOUT_ID,
      requestNonce: "72240000-0000-4000-8000-000000000001",
      purpose: "PROPOSAL",
      targetId: "72250000-0000-4000-8000-000000000001",
      clientUserId: CLIENT_USER_ID,
      providerUserId: PROVIDER_USER_ID,
      paymentProviderAccountId: PAYMENT_ACCOUNT_ID,
      providerName: "MERCADO_PAGO",
      externalReference: EXTERNAL_REFERENCE,
      amountMinor: 125000,
      marketplaceFeeMinor: 12500,
      providerNetExpectedMinor: 112500,
      currencyCode: "ARS",
      status: "REDIRECT_READY",
      providerCheckoutReference: "pref-001",
      checkoutUrl:
        "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-001",
    },
  );
  const recordProviderEvent = vi.fn(async () => EVENT_ID);
  const getProviderEventProcessingStatus = vi.fn(async () =>
    overrides.eventProcessingStatus ?? "RECEIVED",
  );
  const updateProviderEventProcessing = vi.fn(async () => undefined);
  const reconcileProviderPayment = vi.fn(async () => ({
    paymentAttemptId: "72260000-0000-4000-8000-000000000001",
    proposalStatus: "PAID",
    jobId: "72270000-0000-4000-8000-000000000001",
  }));

  const dependencies = {
    now: () => Date.UTC(2026, 8, 5, 22, 30, 0),
    siteUrl: "https://changas.test",
    paymentEnv,
    getCurrentUser: async () => null,
    hasProviderProfile: async () => false,
    getAccountState: async () => null,
    upsertAccount: async () => undefined,
    loadProviderAccountByReference,
    findCheckoutByExternalReference,
    recordProviderEvent,
    getProviderEventProcessingStatus,
    updateProviderEventProcessing,
    reconcileProviderPayment,
    paymentProvider: {
      exchangeOAuthCode: async () => ({}),
      verifyWebhook,
      fetchPayment,
    },
  };

  const server = createPaymentServer(
    dependencies as unknown as Parameters<typeof createPaymentServer>[0],
  ) as unknown as WebhookCapableServer;

  return {
    server,
    verifyWebhook,
    fetchPayment,
    loadProviderAccountByReference,
    findCheckoutByExternalReference,
    recordProviderEvent,
    getProviderEventProcessingStatus,
    updateProviderEventProcessing,
    reconcileProviderPayment,
  };
}

const webhookInput: WebhookInput = {
  xSignature: "ts=1788658200,v1=deadbeef",
  xRequestId: "request-phase11-001",
  dataId: PAYMENT_ID,
  rawBody,
};

async function expectPaymentError(
  operation: () => Promise<unknown>,
  code: string,
) {
  const error = await operation().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PaymentServerError);
  expect(error).toMatchObject({ code });
}

describe("Phase 11 Mercado Pago webhook orchestration", () => {
  it("rejects an invalid signature before any durable mutation or provider fetch", async () => {
    const deps = makeWebhookServer({ signatureValid: false });

    await expectPaymentError(
      () => deps.server.processMercadoPagoWebhook(webhookInput),
      "INVALID_WEBHOOK_SIGNATURE",
    );

    expect(deps.recordProviderEvent).not.toHaveBeenCalled();
    expect(deps.loadProviderAccountByReference).not.toHaveBeenCalled();
    expect(deps.fetchPayment).not.toHaveBeenCalled();
    expect(deps.reconcileProviderPayment).not.toHaveBeenCalled();
  });

  it("persists a verified receipt, refetches authoritative payment with seller OAuth, and reconciles success", async () => {
    const deps = makeWebhookServer();

    const result = await deps.server.processMercadoPagoWebhook(webhookInput);

    expect(deps.verifyWebhook).toHaveBeenCalledWith({
      xSignature: webhookInput.xSignature,
      xRequestId: webhookInput.xRequestId,
      dataId: PAYMENT_ID,
    });
    expect(deps.recordProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "MERCADO_PAGO",
        providerEventKey: "445566",
        providerResourceId: PAYMENT_ID,
        eventType: "PAYMENT.UPDATED",
        signatureValid: true,
        payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(deps.loadProviderAccountByReference).toHaveBeenCalledWith("123456");
    expect(deps.fetchPayment).toHaveBeenCalledWith({
      accessToken: "APP_USR-seller-webhook-token",
      paymentId: PAYMENT_ID,
    });
    expect(deps.findCheckoutByExternalReference).toHaveBeenCalledWith(
      EXTERNAL_REFERENCE,
    );
    expect(deps.reconcileProviderPayment).toHaveBeenCalledWith({
      checkoutSessionId: CHECKOUT_ID,
      providerName: "MERCADO_PAGO",
      providerPaymentReference: PAYMENT_ID,
      providerStatus: "SUCCEEDED",
      providerAmountMinor: 125000,
      providerCurrencyCode: "ARS",
      providerAccountReference: "123456",
      providerEventId: EVENT_ID,
    });
    expect(result).toEqual({ processed: true, duplicate: false });
  });

  it("short-circuits an already processed duplicate event without another provider fetch or financial reconciliation", async () => {
    const deps = makeWebhookServer({ eventProcessingStatus: "PROCESSED" });

    const result = await deps.server.processMercadoPagoWebhook(webhookInput);

    expect(deps.recordProviderEvent).toHaveBeenCalledTimes(1);
    expect(deps.fetchPayment).not.toHaveBeenCalled();
    expect(deps.reconcileProviderPayment).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: true, duplicate: true });
  });

  it.each([
    ["PENDING", "pending"],
    ["FAILED", "rejected"],
  ] as const)(
    "uses authoritative provider status %s even when the incoming body claims approved",
    async (status, rawStatus) => {
      const deps = makeWebhookServer({
        payment: {
          providerPaymentReference: PAYMENT_ID,
          status,
          rawStatus,
          statusDetail: null,
          amountMinor: 125000,
          refundedAmountMinor: 0,
          currencyCode: "ARS",
          providerAccountReference: "123456",
          externalReference: EXTERNAL_REFERENCE,
          providerNetReceivedMinor: null,
        },
      });

      await deps.server.processMercadoPagoWebhook(webhookInput);

      expect(deps.reconcileProviderPayment).toHaveBeenCalledWith(
        expect.objectContaining({ providerStatus: status }),
      );
    },
  );

  it.each([
    ["amount", { amountMinor: 124999 }],
    ["currency", { currencyCode: "USD" }],
    ["seller", { providerAccountReference: "999999" }],
    ["external reference", { externalReference: "changas:checkout:other" }],
  ])(
    "rejects authoritative %s mismatch and records the event as failed",
    async (_label, patch) => {
      const deps = makeWebhookServer({
        payment: {
          providerPaymentReference: PAYMENT_ID,
          status: "SUCCEEDED",
          rawStatus: "approved",
          statusDetail: "accredited",
          amountMinor: 125000,
          refundedAmountMinor: 0,
          currencyCode: "ARS",
          providerAccountReference: "123456",
          externalReference: EXTERNAL_REFERENCE,
          providerNetReceivedMinor: 112500,
          ...patch,
        },
      });

      await expectPaymentError(
        () => deps.server.processMercadoPagoWebhook(webhookInput),
        "RECONCILIATION_MISMATCH",
      );

      expect(deps.reconcileProviderPayment).not.toHaveBeenCalled();
      expect(deps.updateProviderEventProcessing).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: EVENT_ID,
          status: "FAILED",
        }),
      );
    },
  );
});
