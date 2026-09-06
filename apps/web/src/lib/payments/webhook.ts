import "server-only";

import { createHash } from "node:crypto";

import { getPaymentServerEnv } from "@changas/config/server";

import { createAdminClient } from "@/lib/supabase/admin";

import { decryptPaymentToken, type PaymentTokenEnvelope } from "./crypto";
import { MercadoPagoPaymentProvider } from "./mercado-pago";
import type {
  AuthoritativeProviderPayment,
  ProviderPaymentStatus,
  WebhookVerificationInput,
} from "./types";

const MERCADO_PAGO_PROVIDER = "MERCADO_PAGO" as const;

type ProviderEventProcessingStatus =
  "RECEIVED" | "IGNORED" | "PROCESSED" | "FAILED";

type ConnectedSellerAccount = {
  id: string;
  providerUserId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerAccountReference: string;
  status: "CONNECTED";
  accessToken: PaymentTokenEnvelope;
  encryptionKeyVersion: number;
};

type WebhookCheckout = {
  id: string;
  providerUserId: string;
  paymentProviderAccountId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  externalReference: string;
  amountMinor: number;
  currencyCode: string;
};

type ProviderEventInput = {
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerEventKey: string;
  providerResourceId: string;
  eventType: string;
  signatureValid: true;
  payloadSha256: string;
};

type EventProcessingUpdate = {
  eventId: string;
  status: Exclude<ProviderEventProcessingStatus, "RECEIVED">;
  failureCode?: string | null;
  failureMessage?: string | null;
};

type ReconcileProviderPaymentInput = {
  checkoutSessionId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerPaymentReference: string;
  providerStatus: Extract<
    ProviderPaymentStatus,
    "PENDING" | "SUCCEEDED" | "FAILED"
  >;
  providerAmountMinor: number;
  providerCurrencyCode: string;
  providerAccountReference: string;
  providerEventId: string;
};

export type MercadoPagoWebhookInput = {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  rawBody: string;
};

type PaymentWebhookDependencies = {
  paymentEnv: {
    tokenEncryptionKey: string;
  };
  paymentProvider: {
    verifyWebhook(input: WebhookVerificationInput): boolean;
    fetchPayment(input: {
      accessToken: string;
      paymentId: string;
    }): Promise<AuthoritativeProviderPayment>;
  };
  recordProviderEvent(input: ProviderEventInput): Promise<string>;
  getProviderEventProcessingStatus(
    eventId: string,
  ): Promise<ProviderEventProcessingStatus>;
  updateProviderEventProcessing(input: EventProcessingUpdate): Promise<void>;
  loadProviderAccountByReference(
    providerAccountReference: string,
  ): Promise<unknown>;
  findCheckoutByExternalReference(externalReference: string): Promise<unknown>;
  reconcileProviderPayment(
    input: ReconcileProviderPaymentInput,
  ): Promise<unknown>;
};

export type PaymentWebhookErrorCode =
  | "INVALID_WEBHOOK_SIGNATURE"
  | "INVALID_WEBHOOK_EVENT"
  | "SELLER_NOT_CONNECTED"
  | "PROVIDER_UNAVAILABLE"
  | "RECONCILIATION_MISMATCH"
  | "PERSISTENCE_ERROR";

export class PaymentWebhookError extends Error {
  constructor(
    public readonly code: PaymentWebhookErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PaymentWebhookError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireStringish(value: unknown, field: string): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim().length === 0
  ) {
    throw new PaymentWebhookError(
      "INVALID_WEBHOOK_EVENT",
      `Mercado Pago webhook ${field} is invalid`,
    );
  }
  return String(value).trim();
}

function parseWebhookBody(rawBody: string, expectedDataId: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    throw new PaymentWebhookError(
      "INVALID_WEBHOOK_EVENT",
      "Mercado Pago webhook body is not valid JSON",
      error,
    );
  }

  if (!isRecord(parsed) || !isRecord(parsed.data)) {
    throw new PaymentWebhookError(
      "INVALID_WEBHOOK_EVENT",
      "Mercado Pago webhook body is malformed",
    );
  }

  const eventKey = requireStringish(parsed.id, "id");
  const providerAccountReference = requireStringish(parsed.user_id, "user_id");
  const bodyDataId = requireStringish(parsed.data.id, "data.id");
  if (bodyDataId !== expectedDataId) {
    throw new PaymentWebhookError(
      "INVALID_WEBHOOK_EVENT",
      "Mercado Pago webhook resource ID does not match the signed query",
    );
  }

  const action = requireStringish(parsed.action ?? parsed.type, "action");
  return {
    eventKey,
    providerAccountReference,
    eventType: action.toUpperCase(),
  };
}

function normalizeSellerAccount(value: unknown): ConnectedSellerAccount {
  if (!isRecord(value) || value.status !== "CONNECTED") {
    throw new PaymentWebhookError(
      "SELLER_NOT_CONNECTED",
      "Mercado Pago seller account is not connected",
    );
  }
  if (
    typeof value.id !== "string" ||
    typeof value.providerUserId !== "string" ||
    value.providerName !== MERCADO_PAGO_PROVIDER ||
    typeof value.providerAccountReference !== "string" ||
    !isRecord(value.accessToken) ||
    typeof value.encryptionKeyVersion !== "number"
  ) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Stored Mercado Pago seller account is malformed",
    );
  }

  const accessToken = value.accessToken;
  if (
    typeof accessToken.ciphertext !== "string" ||
    typeof accessToken.iv !== "string" ||
    typeof accessToken.authTag !== "string" ||
    typeof accessToken.keyVersion !== "number" ||
    accessToken.keyVersion !== value.encryptionKeyVersion
  ) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Stored Mercado Pago access-token envelope is malformed",
    );
  }

  return {
    id: value.id,
    providerUserId: value.providerUserId,
    providerName: MERCADO_PAGO_PROVIDER,
    providerAccountReference: value.providerAccountReference,
    status: "CONNECTED",
    accessToken: {
      ciphertext: accessToken.ciphertext,
      iv: accessToken.iv,
      authTag: accessToken.authTag,
      keyVersion: accessToken.keyVersion,
    },
    encryptionKeyVersion: value.encryptionKeyVersion,
  };
}

function normalizeCheckout(value: unknown): WebhookCheckout {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.providerUserId !== "string" ||
    typeof value.paymentProviderAccountId !== "string" ||
    value.providerName !== MERCADO_PAGO_PROVIDER ||
    typeof value.externalReference !== "string" ||
    typeof value.amountMinor !== "number" ||
    !Number.isSafeInteger(value.amountMinor) ||
    value.amountMinor <= 0 ||
    typeof value.currencyCode !== "string"
  ) {
    throw new PaymentWebhookError(
      "RECONCILIATION_MISMATCH",
      "Checkout session for provider payment is missing or malformed",
    );
  }

  return {
    id: value.id,
    providerUserId: value.providerUserId,
    paymentProviderAccountId: value.paymentProviderAccountId,
    providerName: MERCADO_PAGO_PROVIDER,
    externalReference: value.externalReference,
    amountMinor: value.amountMinor,
    currencyCode: value.currencyCode,
  };
}

function assertAuthoritativePaymentMatches(
  payment: AuthoritativeProviderPayment,
  checkout: WebhookCheckout,
  seller: ConnectedSellerAccount,
  paymentId: string,
): asserts payment is AuthoritativeProviderPayment & {
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  externalReference: string;
} {
  if (
    payment.providerPaymentReference !== paymentId ||
    payment.externalReference !== checkout.externalReference ||
    payment.amountMinor !== checkout.amountMinor ||
    payment.currencyCode !== checkout.currencyCode ||
    payment.providerAccountReference !== seller.providerAccountReference ||
    checkout.paymentProviderAccountId !== seller.id ||
    checkout.providerUserId !== seller.providerUserId ||
    (payment.status !== "PENDING" &&
      payment.status !== "SUCCEEDED" &&
      payment.status !== "FAILED")
  ) {
    throw new PaymentWebhookError(
      "RECONCILIATION_MISMATCH",
      "Authoritative Mercado Pago payment does not match durable checkout truth",
    );
  }
}

async function failEvent(
  dependencies: PaymentWebhookDependencies,
  eventId: string,
  error: PaymentWebhookError,
) {
  try {
    await dependencies.updateProviderEventProcessing({
      eventId,
      status: "FAILED",
      failureCode: error.code,
      failureMessage: error.message,
    });
  } catch (persistenceError) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Unable to record failed Mercado Pago webhook processing",
      persistenceError,
    );
  }
}

export function createPaymentWebhookProcessor(
  dependencies: PaymentWebhookDependencies,
) {
  return async function processMercadoPagoWebhook(
    input: MercadoPagoWebhookInput,
  ): Promise<{ processed: boolean; duplicate: boolean }> {
    const dataId = input.dataId?.trim() ?? "";
    if (dataId.length === 0) {
      throw new PaymentWebhookError(
        "INVALID_WEBHOOK_EVENT",
        "Mercado Pago webhook data.id is required",
      );
    }

    if (
      !dependencies.paymentProvider.verifyWebhook({
        xSignature: input.xSignature,
        xRequestId: input.xRequestId,
        dataId,
      })
    ) {
      throw new PaymentWebhookError(
        "INVALID_WEBHOOK_SIGNATURE",
        "Mercado Pago webhook signature is invalid",
      );
    }

    const body = parseWebhookBody(input.rawBody, dataId);
    const payloadSha256 = createHash("sha256")
      .update(input.rawBody, "utf8")
      .digest("hex");

    let eventId: string;
    try {
      eventId = await dependencies.recordProviderEvent({
        providerName: MERCADO_PAGO_PROVIDER,
        providerEventKey: body.eventKey,
        providerResourceId: dataId,
        eventType: body.eventType,
        signatureValid: true,
        payloadSha256,
      });
      const processingStatus =
        await dependencies.getProviderEventProcessingStatus(eventId);
      if (processingStatus === "PROCESSED" || processingStatus === "IGNORED") {
        return { processed: true, duplicate: true };
      }
    } catch (error) {
      if (error instanceof PaymentWebhookError) throw error;
      throw new PaymentWebhookError(
        "PERSISTENCE_ERROR",
        "Unable to persist Mercado Pago webhook receipt",
        error,
      );
    }

    let seller: ConnectedSellerAccount;
    try {
      seller = normalizeSellerAccount(
        await dependencies.loadProviderAccountByReference(
          body.providerAccountReference,
        ),
      );
    } catch (error) {
      const normalized =
        error instanceof PaymentWebhookError
          ? error
          : new PaymentWebhookError(
              "PERSISTENCE_ERROR",
              "Unable to load Mercado Pago seller account",
              error,
            );
      await failEvent(dependencies, eventId, normalized);
      throw normalized;
    }

    let payment: AuthoritativeProviderPayment;
    try {
      payment = await dependencies.paymentProvider.fetchPayment({
        accessToken: decryptPaymentToken(
          seller.accessToken,
          dependencies.paymentEnv.tokenEncryptionKey,
        ),
        paymentId: dataId,
      });
    } catch (error) {
      throw new PaymentWebhookError(
        "PROVIDER_UNAVAILABLE",
        "Unable to fetch authoritative Mercado Pago payment",
        error,
      );
    }

    try {
      if (!payment.externalReference) {
        throw new PaymentWebhookError(
          "RECONCILIATION_MISMATCH",
          "Mercado Pago payment has no Changas external reference",
        );
      }
      const checkout = normalizeCheckout(
        await dependencies.findCheckoutByExternalReference(
          payment.externalReference,
        ),
      );
      assertAuthoritativePaymentMatches(payment, checkout, seller, dataId);

      await dependencies.reconcileProviderPayment({
        checkoutSessionId: checkout.id,
        providerName: MERCADO_PAGO_PROVIDER,
        providerPaymentReference: payment.providerPaymentReference,
        providerStatus: payment.status,
        providerAmountMinor: payment.amountMinor,
        providerCurrencyCode: payment.currencyCode,
        providerAccountReference: payment.providerAccountReference,
        providerEventId: eventId,
      });
      return { processed: true, duplicate: false };
    } catch (error) {
      const normalized =
        error instanceof PaymentWebhookError
          ? error
          : new PaymentWebhookError(
              "RECONCILIATION_MISMATCH",
              "Mercado Pago payment reconciliation failed",
              error,
            );
      await failEvent(dependencies, eventId, normalized);
      throw normalized;
    }
  };
}

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

type RpcClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

type TableSelectQuery = {
  select(columns: string): TableSelectQuery;
  eq(column: string, value: unknown): TableSelectQuery;
  maybeSingle(): PromiseLike<RpcResult>;
};

type TableClient = {
  from(table: string): TableSelectQuery;
};

function requireRpcString(data: unknown, operation: string): string {
  if (typeof data !== "string" || data.length === 0) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      `${operation} returned an invalid identifier`,
    );
  }
  return data;
}

async function recordProviderEvent(input: ProviderEventInput): Promise<string> {
  const admin = createAdminClient() as unknown as RpcClient;
  const { data, error } = await admin.rpc("record_payment_provider_event", {
    payment_provider_name: input.providerName,
    payment_provider_event_key: input.providerEventKey,
    payment_provider_resource_id: input.providerResourceId,
    payment_event_type: input.eventType,
    payment_signature_valid: input.signatureValid,
    payment_payload_sha256: input.payloadSha256,
    payment_provider_status: null,
    payment_provider_reference: null,
  });
  if (error) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Unable to record Mercado Pago provider event",
      error,
    );
  }
  return requireRpcString(data, "Provider event persistence");
}

async function getProviderEventProcessingStatus(
  eventId: string,
): Promise<ProviderEventProcessingStatus> {
  const admin = createAdminClient() as unknown as TableClient;
  const { data, error } = await admin
    .from("payment_provider_events")
    .select("processing_status")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Unable to read Mercado Pago provider event status",
      error,
    );
  }
  return data.processing_status;
}

async function updateProviderEventProcessing(
  input: EventProcessingUpdate,
): Promise<void> {
  const admin = createAdminClient() as unknown as RpcClient;
  const { error } = await admin.rpc(
    "update_payment_provider_event_processing",
    {
      target_event_id: input.eventId,
      target_processing_status: input.status,
      target_failure_code: input.failureCode ?? null,
      target_failure_message: input.failureMessage ?? null,
    },
  );
  if (error) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Unable to update Mercado Pago provider event processing",
      error,
    );
  }
}

async function loadProviderAccountByReference(
  providerAccountReference: string,
): Promise<unknown> {
  const admin = createAdminClient() as unknown as TableClient;
  const { data, error } = await admin
    .from("payment_provider_accounts")
    .select(
      "id,provider_user_id,provider_name,provider_account_reference,status,access_token_ciphertext,access_token_iv,access_token_auth_tag,encryption_key_version",
    )
    .eq("provider_name", MERCADO_PAGO_PROVIDER)
    .eq("provider_account_reference", providerAccountReference)
    .maybeSingle();
  if (error) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Unable to load Mercado Pago provider account",
      error,
    );
  }
  if (!data) return null;
  return {
    id: data.id,
    providerUserId: data.provider_user_id,
    providerName: data.provider_name,
    providerAccountReference: data.provider_account_reference,
    status: data.status,
    accessToken: {
      ciphertext: data.access_token_ciphertext,
      iv: data.access_token_iv,
      authTag: data.access_token_auth_tag,
      keyVersion: data.encryption_key_version,
    },
    encryptionKeyVersion: data.encryption_key_version,
  };
}

async function findCheckoutByExternalReference(
  externalReference: string,
): Promise<unknown> {
  const admin = createAdminClient() as unknown as TableClient;
  const { data, error } = await admin
    .from("payment_checkout_sessions")
    .select(
      "id,provider_user_id,payment_provider_account_id,provider_name,external_reference,amount_minor,currency_code",
    )
    .eq("external_reference", externalReference)
    .maybeSingle();
  if (error) {
    throw new PaymentWebhookError(
      "PERSISTENCE_ERROR",
      "Unable to load durable payment checkout",
      error,
    );
  }
  if (!data) return null;
  return {
    id: data.id,
    providerUserId: data.provider_user_id,
    paymentProviderAccountId: data.payment_provider_account_id,
    providerName: data.provider_name,
    externalReference: data.external_reference,
    amountMinor: Number(data.amount_minor),
    currencyCode: data.currency_code,
  };
}

async function reconcileProviderPayment(
  input: ReconcileProviderPaymentInput,
): Promise<unknown> {
  const admin = createAdminClient() as unknown as RpcClient;
  const { data, error } = await admin.rpc("reconcile_provider_payment", {
    target_checkout_session_id: input.checkoutSessionId,
    payment_provider_name: input.providerName,
    payment_provider_reference: input.providerPaymentReference,
    payment_result_status: input.providerStatus,
    payment_amount_minor: input.providerAmountMinor,
    payment_currency_code: input.providerCurrencyCode,
    payment_provider_account_reference: input.providerAccountReference,
    source_provider_event_id: input.providerEventId,
  });
  if (error) {
    throw new PaymentWebhookError(
      "RECONCILIATION_MISMATCH",
      "Durable Mercado Pago reconciliation rejected the payment",
      error,
    );
  }
  return data;
}

let defaultProcessor:
  ReturnType<typeof createPaymentWebhookProcessor> | undefined;

export async function processMercadoPagoWebhook(
  input: MercadoPagoWebhookInput,
) {
  if (!defaultProcessor) {
    const env = getPaymentServerEnv();
    const provider = new MercadoPagoPaymentProvider({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      webhookSecret: env.webhookSecret,
    });
    defaultProcessor = createPaymentWebhookProcessor({
      paymentEnv: { tokenEncryptionKey: env.tokenEncryptionKey },
      paymentProvider: provider,
      recordProviderEvent,
      getProviderEventProcessingStatus,
      updateProviderEventProcessing,
      loadProviderAccountByReference,
      findCheckoutByExternalReference,
      reconcileProviderPayment,
    });
  }
  return defaultProcessor(input);
}
