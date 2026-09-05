import { describe, expect, it } from "vitest";

import {
  MercadoPagoPaymentProvider,
  MercadoPagoProviderError,
} from "./mercado-pago";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const createFetchQueue = (...responses: Response[]) => {
  const requests: Array<{
    input: RequestInfo | URL;
    init: RequestInit | undefined;
  }> = [];
  let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({ input, init });
    const response = responses[index++];
    if (!response) throw new Error("unexpected fetch call");
    return response;
  };
  return { fetchImpl, requests };
};

const createProvider = (fetchImpl: typeof fetch) =>
  new MercadoPagoPaymentProvider({
    clientId: "phase11-client-id",
    clientSecret: "phase11-client-secret",
    webhookSecret: "phase11-webhook-secret",
    fetchImpl,
  });

describe("Phase 11 Mercado Pago provider adapter", () => {
  it(
    "exchanges an OAuth authorization code without leaking client credentials into the URL",
    async () => {
      const queue = createFetchQueue(
        jsonResponse({
          access_token: "APP_USR-access-1",
          token_type: "bearer",
          expires_in: 15552000,
          scope: "offline_access read write",
          user_id: 123456,
          refresh_token: "TG-refresh-1",
        }),
      );
      const provider = createProvider(queue.fetchImpl);

      const result = await provider.exchangeOAuthCode({
        code: "authorization-code-1",
        redirectUri: "https://changas.test/payments/mercado-pago/callback",
      });

      expect(result).toMatchObject({
        accessToken: "APP_USR-access-1",
        refreshToken: "TG-refresh-1",
        expiresInSeconds: 15552000,
        providerAccountReference: "123456",
      });
      expect(String(queue.requests[0]?.input)).toBe(
        "https://api.mercadopago.com/oauth/token",
      );
      expect(String(queue.requests[0]?.input)).not.toContain(
        "phase11-client-secret",
      );
      const body = JSON.parse(String(queue.requests[0]?.init?.body));
      expect(body).toMatchObject({
        client_id: "phase11-client-id",
        client_secret: "phase11-client-secret",
        code: "authorization-code-1",
        grant_type: "authorization_code",
        redirect_uri: "https://changas.test/payments/mercado-pago/callback",
      });
    },
  );

  it(
    "refreshes OAuth credentials and returns the rotated refresh token",
    async () => {
      const queue = createFetchQueue(
        jsonResponse({
          access_token: "APP_USR-access-2",
          token_type: "bearer",
          expires_in: 15552000,
          scope: "offline_access read write",
          user_id: 123456,
          refresh_token: "TG-refresh-2-rotated",
        }),
      );
      const provider = createProvider(queue.fetchImpl);

      const result = await provider.refreshOAuthToken({
        refreshToken: "TG-refresh-1",
      });

      expect(result.refreshToken).toBe("TG-refresh-2-rotated");
      const body = JSON.parse(String(queue.requests[0]?.init?.body));
      expect(body).toMatchObject({
        client_id: "phase11-client-id",
        client_secret: "phase11-client-secret",
        grant_type: "refresh_token",
        refresh_token: "TG-refresh-1",
      });
    },
  );

  it(
    "creates Checkout Pro preferences with split fee and durable references",
    async () => {
      const queue = createFetchQueue(
        jsonResponse({
          id: "pref-001",
          init_point:
            "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-001",
          sandbox_init_point:
            "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-001",
        }),
      );
      const provider = createProvider(queue.fetchImpl);

      const result = await provider.createCheckoutSession({
        accessToken: "APP_USR-seller-token",
        title: "Reparación de PC",
        description: "Trabajo confirmado en Changas",
        amountMinor: 100000,
        currencyCode: "ARS",
        marketplaceFeeMinor: 10000,
        externalReference: "phase11:proposal:abc",
        notificationUrl: "https://changas.test/api/payments/mercado-pago/webhook",
        backUrls: {
          success: "https://changas.test/payments/return/success",
          pending: "https://changas.test/payments/return/pending",
          failure: "https://changas.test/payments/return/failure",
        },
        idempotencyKey: "checkout-nonce-001",
      });

      expect(result).toMatchObject({
        providerCheckoutReference: "pref-001",
        checkoutUrl:
          "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-001",
      });
      expect(String(queue.requests[0]?.input)).toBe(
        "https://api.mercadopago.com/checkout/preferences",
      );
      expect(queue.requests[0]?.init?.headers).toMatchObject({
        Authorization: "Bearer APP_USR-seller-token",
        "X-Idempotency-Key": "checkout-nonce-001",
      });
      const body = JSON.parse(String(queue.requests[0]?.init?.body));
      expect(body).toMatchObject({
        external_reference: "phase11:proposal:abc",
        notification_url: "https://changas.test/api/payments/mercado-pago/webhook",
        marketplace_fee: 100,
        auto_return: "approved",
        back_urls: {
          success: "https://changas.test/payments/return/success",
          pending: "https://changas.test/payments/return/pending",
          failure: "https://changas.test/payments/return/failure",
        },
      });
      expect(body.items).toEqual([
        expect.objectContaining({
          title: "Reparación de PC",
          quantity: 1,
          currency_id: "ARS",
          unit_price: 1000,
        }),
      ]);
    },
  );

  it.each([
    ["approved", "SUCCEEDED"],
    ["pending", "PENDING"],
    ["in_process", "PENDING"],
    ["rejected", "FAILED"],
    ["cancelled", "FAILED"],
    ["refunded", "REFUNDED"],
  ] as const)(
    "normalizes provider payment status %s",
    async (rawStatus, expected) => {
      const queue = createFetchQueue(
        jsonResponse({
          id: 987654,
          status: rawStatus,
          status_detail: "provider-detail",
          currency_id: "ARS",
          collector_id: 123456,
          external_reference: "phase11:proposal:abc",
          transaction_amount: 1000,
          transaction_amount_refunded: rawStatus === "refunded" ? 1000 : 0,
          transaction_details: { net_received_amount: 900 },
        }),
      );
      const provider = createProvider(queue.fetchImpl);

      const result = await provider.fetchPayment({
        accessToken: "APP_USR-seller-token",
        paymentId: "987654",
      });

      expect(result.status).toBe(expected);
      expect(result).toMatchObject({
        providerPaymentReference: "987654",
        amountMinor: 100000,
        currencyCode: "ARS",
        providerAccountReference: "123456",
        externalReference: "phase11:proposal:abc",
        providerNetReceivedMinor: 90000,
      });
    },
  );

  it(
    "rejects malformed authoritative provider payloads instead of guessing financial truth",
    async () => {
      const queue = createFetchQueue(
        jsonResponse({ id: 12, status: "approved", currency_id: "ARS" }),
      );
      const provider = createProvider(queue.fetchImpl);

      await expect(
        provider.fetchPayment({
          accessToken: "APP_USR-seller-token",
          paymentId: "12",
        }),
      ).rejects.toMatchObject({ code: "INVALID_PROVIDER_STATE" });
    },
  );

  it(
    "supports partial and total refunds with provider idempotency keys",
    async () => {
      const queue = createFetchQueue(
        jsonResponse({
          id: 1,
          payment_id: 987654,
          amount: 250,
          status: "approved",
        }),
        jsonResponse({
          id: 2,
          payment_id: 987654,
          amount: 1000,
          status: "approved",
        }),
      );
      const provider = createProvider(queue.fetchImpl);

      const partial = await provider.refund({
        accessToken: "APP_USR-seller-token",
        paymentId: "987654",
        idempotencyKey: "refund-partial-001",
        amountMinor: 25000,
      });
      const total = await provider.refund({
        accessToken: "APP_USR-seller-token",
        paymentId: "987654",
        idempotencyKey: "refund-total-001",
      });

      expect(partial.amountMinor).toBe(25000);
      expect(total.amountMinor).toBe(100000);
      expect(queue.requests[0]?.init?.headers).toMatchObject({
        "X-Idempotency-Key": "refund-partial-001",
      });
      expect(JSON.parse(String(queue.requests[0]?.init?.body))).toEqual({
        amount: 250,
      });
      expect(queue.requests[1]?.init?.headers).toMatchObject({
        "X-Idempotency-Key": "refund-total-001",
      });
      expect(queue.requests[1]?.init?.body).toBeUndefined();
    },
  );

  it.each([
    [429, "RATE_LIMITED"],
    [500, "PROVIDER_UNAVAILABLE"],
    [503, "PROVIDER_UNAVAILABLE"],
  ] as const)(
    "classifies transient provider HTTP %s",
    async (status, code) => {
      const queue = createFetchQueue(
        jsonResponse({ message: "temporary" }, status),
      );
      const provider = createProvider(queue.fetchImpl);

      const error = await provider
        .fetchPayment({ accessToken: "APP_USR-token", paymentId: "123" })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(MercadoPagoProviderError);
      expect(error).toMatchObject({ code, httpStatus: status });
    },
  );

  it(
    "validates Mercado Pago webhook HMAC using the documented manifest and rejects tampering",
    () => {
      const provider = createProvider(async () => {
        throw new Error("webhook verification must not perform network I/O");
      });
      const signature =
        "ts=1704908010,v1=17734a70a6aea920a8b0e5610aa152de17c685a89eabe2cba3dd51e34784c735";

      expect(
        provider.verifyWebhook({
          xSignature: signature,
          xRequestId: "request-abc-123",
          dataId: "123456789",
        }),
      ).toBe(true);
      expect(
        provider.verifyWebhook({
          xSignature: signature,
          xRequestId: "request-tampered",
          dataId: "123456789",
        }),
      ).toBe(false);
    },
  );
});
