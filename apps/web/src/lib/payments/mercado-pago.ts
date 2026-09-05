import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  AuthoritativeProviderPayment,
  CheckoutSessionInput,
  CheckoutSessionResult,
  OAuthCredentials,
  PaymentProviderErrorCode,
  ProviderPaymentStatus,
  ProviderRefundResult,
  WebhookVerificationInput,
} from "./types";

const MERCADO_PAGO_API = "https://api.mercadopago.com";
const MINOR_UNITS = 100;

export class MercadoPagoProviderError extends Error {
  readonly code: PaymentProviderErrorCode;
  readonly httpStatus: number | undefined;

  constructor(
    code: PaymentProviderErrorCode,
    message: string,
    options: { httpStatus?: number; cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "MercadoPagoProviderError";
    this.code = code;
    this.httpStatus = options.httpStatus;
  }
}

type MercadoPagoPaymentProviderOptions = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  fetchImpl?: typeof fetch;
};

type OAuthExchangeInput = {
  code: string;
  redirectUri: string;
};

type OAuthRefreshInput = {
  refreshToken: string;
};

type FetchPaymentInput = {
  accessToken: string;
  paymentId: string;
};

type RefundInput = {
  accessToken: string;
  paymentId: string;
  idempotencyKey: string;
  amountMinor?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (
  value: unknown,
  field: string,
  allowEmpty = false,
): string => {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new MercadoPagoProviderError(
      "INVALID_PROVIDER_STATE",
      `Mercado Pago payload field ${field} is invalid`,
    );
  }
  return value;
};

const requireFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MercadoPagoProviderError(
      "INVALID_PROVIDER_STATE",
      `Mercado Pago payload field ${field} is invalid`,
    );
  }
  return value;
};

const requireProviderReference = (value: unknown, field: string): string => {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new MercadoPagoProviderError(
    "INVALID_PROVIDER_STATE",
    `Mercado Pago payload field ${field} is invalid`,
  );
};

const assertMinorAmount = (amountMinor: number, field: string): void => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new MercadoPagoProviderError(
      "INTERNAL_ERROR",
      `${field} must be a non-negative safe integer in minor units`,
    );
  }
};

const minorToProviderMajor = (amountMinor: number, field: string): number => {
  assertMinorAmount(amountMinor, field);
  return amountMinor / MINOR_UNITS;
};

const providerMajorToMinor = (amount: unknown, field: string): number => {
  const major = requireFiniteNumber(amount, field);
  const minor = Math.round(major * MINOR_UNITS);
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new MercadoPagoProviderError(
      "INVALID_PROVIDER_STATE",
      `Mercado Pago payload field ${field} is outside supported money bounds`,
    );
  }
  return minor;
};

const normalizePaymentStatus = (status: string): ProviderPaymentStatus => {
  switch (status) {
    case "approved":
      return "SUCCEEDED";
    case "pending":
    case "in_process":
      return "PENDING";
    case "rejected":
    case "cancelled":
      return "FAILED";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    default:
      throw new MercadoPagoProviderError(
        "INVALID_PROVIDER_STATE",
        `Unsupported Mercado Pago payment status: ${status}`,
      );
  }
};

const classifyHttpError = (
  status: number,
  fallbackCode: PaymentProviderErrorCode,
): PaymentProviderErrorCode => {
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return fallbackCode;
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch (error) {
    throw new MercadoPagoProviderError(
      "INVALID_PROVIDER_STATE",
      "Mercado Pago returned a non-JSON payload",
      { httpStatus: response.status, cause: error },
    );
  }
};

const getOptionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new MercadoPagoProviderError(
      "INVALID_PROVIDER_STATE",
      "Mercado Pago returned an invalid optional string field",
    );
  }
  return value;
};

export class MercadoPagoPaymentProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookSecret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MercadoPagoPaymentProviderOptions) {
    if (!options.clientId || !options.clientSecret || !options.webhookSecret) {
      throw new MercadoPagoProviderError(
        "INTERNAL_ERROR",
        "Mercado Pago provider configuration is incomplete",
      );
    }
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.webhookSecret = options.webhookSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async exchangeOAuthCode(
    input: OAuthExchangeInput,
  ): Promise<OAuthCredentials> {
    return this.exchangeOAuthToken({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    });
  }

  async refreshOAuthToken(input: OAuthRefreshInput): Promise<OAuthCredentials> {
    return this.exchangeOAuthToken({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    });
  }

  private async exchangeOAuthToken(
    body: Record<string, string>,
  ): Promise<OAuthCredentials> {
    const payload = await this.requestJson(
      `${MERCADO_PAGO_API}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      },
      "AUTH_REQUIRED",
    );

    if (!isRecord(payload)) {
      throw new MercadoPagoProviderError(
        "INVALID_PROVIDER_STATE",
        "Mercado Pago OAuth response is malformed",
      );
    }

    const accessToken = requireString(payload.access_token, "access_token");
    const refreshToken = requireString(payload.refresh_token, "refresh_token");
    const expiresInSeconds = requireFiniteNumber(
      payload.expires_in,
      "expires_in",
    );
    if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new MercadoPagoProviderError(
        "INVALID_PROVIDER_STATE",
        "Mercado Pago OAuth expires_in is invalid",
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresInSeconds,
      providerAccountReference: requireProviderReference(
        payload.user_id,
        "user_id",
      ),
      scope: getOptionalString(payload.scope),
    };
  }

  async createCheckoutSession(
    input: CheckoutSessionInput,
  ): Promise<CheckoutSessionResult> {
    assertMinorAmount(input.amountMinor, "amountMinor");
    assertMinorAmount(input.marketplaceFeeMinor, "marketplaceFeeMinor");
    if (
      input.amountMinor <= 0 ||
      input.marketplaceFeeMinor > input.amountMinor
    ) {
      throw new MercadoPagoProviderError(
        "INTERNAL_ERROR",
        "Checkout economics are invalid",
      );
    }

    const item: Record<string, unknown> = {
      title: input.title,
      quantity: 1,
      currency_id: input.currencyCode,
      unit_price: minorToProviderMajor(input.amountMinor, "amountMinor"),
    };
    if (input.description !== undefined) item.description = input.description;

    const payload = await this.requestJson(
      `${MERCADO_PAGO_API}/checkout/preferences`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          items: [item],
          back_urls: input.backUrls,
          auto_return: "approved",
          notification_url: input.notificationUrl,
          external_reference: input.externalReference,
          marketplace_fee: minorToProviderMajor(
            input.marketplaceFeeMinor,
            "marketplaceFeeMinor",
          ),
        }),
      },
      "PAYMENT_REJECTED",
    );

    if (!isRecord(payload)) {
      throw new MercadoPagoProviderError(
        "INVALID_PROVIDER_STATE",
        "Mercado Pago preference response is malformed",
      );
    }

    return {
      providerCheckoutReference: requireString(payload.id, "id"),
      checkoutUrl: requireString(payload.init_point, "init_point"),
      sandboxCheckoutUrl: getOptionalString(payload.sandbox_init_point),
    };
  }

  async fetchPayment(
    input: FetchPaymentInput,
  ): Promise<AuthoritativeProviderPayment> {
    const payload = await this.requestJson(
      `${MERCADO_PAGO_API}/v1/payments/${encodeURIComponent(input.paymentId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${input.accessToken}` },
      },
      "INVALID_PROVIDER_STATE",
    );

    if (!isRecord(payload)) {
      throw new MercadoPagoProviderError(
        "INVALID_PROVIDER_STATE",
        "Mercado Pago payment response is malformed",
      );
    }

    const rawStatus = requireString(payload.status, "status");
    const transactionDetails = payload.transaction_details;
    let providerNetReceivedMinor: number | null = null;
    if (transactionDetails !== null && transactionDetails !== undefined) {
      if (!isRecord(transactionDetails)) {
        throw new MercadoPagoProviderError(
          "INVALID_PROVIDER_STATE",
          "Mercado Pago transaction_details is malformed",
        );
      }
      if (
        transactionDetails.net_received_amount !== null &&
        transactionDetails.net_received_amount !== undefined
      ) {
        providerNetReceivedMinor = providerMajorToMinor(
          transactionDetails.net_received_amount,
          "transaction_details.net_received_amount",
        );
      }
    }

    return {
      providerPaymentReference: requireProviderReference(payload.id, "id"),
      status: normalizePaymentStatus(rawStatus),
      rawStatus,
      statusDetail: getOptionalString(payload.status_detail),
      amountMinor: providerMajorToMinor(
        payload.transaction_amount,
        "transaction_amount",
      ),
      refundedAmountMinor: providerMajorToMinor(
        payload.transaction_amount_refunded ?? 0,
        "transaction_amount_refunded",
      ),
      currencyCode: requireString(payload.currency_id, "currency_id"),
      providerAccountReference: requireProviderReference(
        payload.collector_id,
        "collector_id",
      ),
      externalReference: getOptionalString(payload.external_reference),
      providerNetReceivedMinor,
    };
  }

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    if (input.amountMinor !== undefined) {
      assertMinorAmount(input.amountMinor, "amountMinor");
      if (input.amountMinor <= 0) {
        throw new MercadoPagoProviderError(
          "INTERNAL_ERROR",
          "Partial refund amount must be positive",
        );
      }
    }

    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
    };
    if (input.amountMinor !== undefined) {
      init.body = JSON.stringify({
        amount: minorToProviderMajor(input.amountMinor, "amountMinor"),
      });
    }

    const payload = await this.requestJson(
      `${MERCADO_PAGO_API}/v1/payments/${encodeURIComponent(
        input.paymentId,
      )}/refunds`,
      init,
      "REFUND_REJECTED",
    );

    if (!isRecord(payload)) {
      throw new MercadoPagoProviderError(
        "INVALID_PROVIDER_STATE",
        "Mercado Pago refund response is malformed",
      );
    }

    return {
      providerRefundReference: requireProviderReference(payload.id, "id"),
      providerPaymentReference: requireProviderReference(
        payload.payment_id,
        "payment_id",
      ),
      amountMinor: providerMajorToMinor(payload.amount, "amount"),
      rawStatus: requireString(payload.status, "status"),
    };
  }

  verifyWebhook(input: WebhookVerificationInput): boolean {
    const signature = input.xSignature?.trim();
    if (!signature) return false;

    const parts = new Map<string, string>();
    for (const rawPart of signature.split(",")) {
      const [rawKey, ...rawValueParts] = rawPart.split("=");
      const key = rawKey?.trim();
      const value = rawValueParts.join("=").trim();
      if (key && value) parts.set(key, value);
    }

    const timestamp = parts.get("ts");
    const providedHash = parts.get("v1");
    if (
      !timestamp ||
      !providedHash ||
      !/^[a-fA-F0-9]{64}$/.test(providedHash)
    ) {
      return false;
    }

    const manifestParts: string[] = [];
    if (input.dataId) manifestParts.push(`id:${input.dataId}`);
    if (input.xRequestId) manifestParts.push(`request-id:${input.xRequestId}`);
    manifestParts.push(`ts:${timestamp}`);
    const manifest = `${manifestParts.join(";")};`;

    const expectedHash = createHmac("sha256", this.webhookSecret)
      .update(manifest)
      .digest("hex");
    const expected = Buffer.from(expectedHash, "hex");
    const received = Buffer.from(providedHash, "hex");
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  private async requestJson(
    url: string,
    init: RequestInit,
    fallbackCode: PaymentProviderErrorCode,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      if (error instanceof MercadoPagoProviderError) throw error;
      throw new MercadoPagoProviderError(
        "PROVIDER_UNAVAILABLE",
        "Mercado Pago request failed before receiving a response",
        { cause: error },
      );
    }

    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      throw new MercadoPagoProviderError(
        classifyHttpError(response.status, fallbackCode),
        "Mercado Pago request was rejected",
        { httpStatus: response.status },
      );
    }
    return payload;
  }
}
