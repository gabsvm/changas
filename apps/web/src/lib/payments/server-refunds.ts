import "server-only";

import { getPaymentServerEnv, type PaymentServerEnv } from "@changas/config/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { decryptPaymentToken, type PaymentTokenEnvelope } from "./crypto";
import { MercadoPagoPaymentProvider } from "./mercado-pago";
import { PaymentServerError } from "./server";
import type { ProviderRefundResult } from "./types";

const MERCADO_PAGO_PROVIDER = "MERCADO_PAGO" as const;

type RefundStatus = "REQUESTED" | "PENDING" | "SUCCEEDED" | "FAILED";

type RefundablePaymentSnapshot = {
  paymentAttemptId: string;
  clientUserId: string;
  providerUserId: string;
  paymentProviderAccountId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerPaymentReference: string;
  amountMinor: number;
  refundableRemainingMinor: number;
  currencyCode: string;
  paymentStatus: "SUCCEEDED" | "REFUNDED";
  providerAccountReference: string;
  accessToken: PaymentTokenEnvelope;
  encryptionKeyVersion: number;
};

type RefundRecord = {
  id: string;
  paymentAttemptId: string;
  requestNonce: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerPaymentReference: string;
  providerRefundReference: string | null;
  amountMinor: number;
  currencyCode: string;
  status: RefundStatus;
  reasonCode: string | null;
};

type RefundResult = {
  refundId: string;
  amountMinor: number;
  currencyCode: string;
  status: RefundStatus;
  providerRefundReference: string | null;
};

export type RefundReconciliationInput = {
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  providerRefundReference?: string | null;
  reasonCode?: string | null;
  providerEventId?: string | null;
};

export type PaymentReconciliationScope = {
  initiatedByUserId?: string | null;
  initiatorType?: "ADMIN" | "SYSTEM";
  providerName?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
};

type ReconciliationCounters = {
  checkedCount: number;
  matchedCount: number;
  mismatchedCount: number;
  failedCount: number;
};

type RefundServerDependencies = {
  paymentEnv: Pick<PaymentServerEnv, "tokenEncryptionKey"> | (() => Pick<PaymentServerEnv, "tokenEncryptionKey">);
  getCurrentUser: () => Promise<{ id: string } | null>;
  loadPaymentRefundSnapshot: (paymentAttemptId: string) => Promise<unknown>;
  findRefundByNonce: (requestNonce: string) => Promise<unknown>;
  createRefundRecord: (input: {
    paymentAttemptId: string;
    requestNonce: string;
    requestedByUserId: string;
    amountMinor: number;
    currencyCode: string;
    status: "REQUESTED";
  }) => Promise<unknown>;
  markRefundProviderResult: (input: {
    refundId: string;
    providerRefundReference: string | null;
    status: "PENDING" | "SUCCEEDED" | "FAILED";
    reasonCode?: string | null;
    providerEventId?: string | null;
  }) => Promise<unknown>;
  startReconciliationRun?: (scope: PaymentReconciliationScope) => Promise<string>;
  finishReconciliationRun?: (input: ReconciliationCounters & {
    runId: string;
    errorSummary?: string | null;
  }) => Promise<void>;
  performReconciliation?: (scope: PaymentReconciliationScope) => Promise<ReconciliationCounters>;
  paymentProvider: {
    refund(input: {
      accessToken: string;
      paymentId: string;
      idempotencyKey: string;
      amountMinor: number;
    }): Promise<ProviderRefundResult>;
  };
};

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

type RpcClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid refund field: ${field}`,
    );
  }
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requireString(value, field);
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid refund amount field: ${field}`,
    );
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid refund amount field: ${field}`,
    );
  }
  return value;
}

function requireCurrency(value: unknown): string {
  const currency = requireString(value, "currencyCode");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Refund currency is invalid",
    );
  }
  return currency;
}

function normalizeTokenEnvelope(value: unknown, keyVersion: number): PaymentTokenEnvelope {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Stored refund access token is unavailable",
    );
  }
  const envelope = {
    ciphertext: requireString(value.ciphertext, "ciphertext"),
    iv: requireString(value.iv, "iv"),
    authTag: requireString(value.authTag, "authTag"),
    keyVersion: requirePositiveInteger(value.keyVersion, "keyVersion"),
  };
  if (envelope.keyVersion !== keyVersion) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Refund access-token key version mismatch",
    );
  }
  return envelope;
}

function normalizeSnapshot(value: unknown, paymentAttemptId: string): RefundablePaymentSnapshot {
  if (!isRecord(value)) {
    throw new PaymentServerError("NOT_FOUND", "Payment attempt was not found");
  }
  if (value.paymentAttemptId !== paymentAttemptId) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Refund payment snapshot does not match the requested attempt",
    );
  }
  if (value.providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Refund payment provider is unsupported",
    );
  }
  if (value.paymentStatus !== "SUCCEEDED" && value.paymentStatus !== "REFUNDED") {
    throw new PaymentServerError("CONFLICT", "Payment is not refundable");
  }

  const encryptionKeyVersion = requirePositiveInteger(
    value.encryptionKeyVersion,
    "encryptionKeyVersion",
  );
  return {
    paymentAttemptId,
    clientUserId: requireString(value.clientUserId, "clientUserId"),
    providerUserId: requireString(value.providerUserId, "providerUserId"),
    paymentProviderAccountId: requireString(
      value.paymentProviderAccountId,
      "paymentProviderAccountId",
    ),
    providerName: MERCADO_PAGO_PROVIDER,
    providerPaymentReference: requireString(
      value.providerPaymentReference,
      "providerPaymentReference",
    ),
    amountMinor: requirePositiveInteger(value.amountMinor, "amountMinor"),
    refundableRemainingMinor: requireNonNegativeInteger(
      value.refundableRemainingMinor,
      "refundableRemainingMinor",
    ),
    currencyCode: requireCurrency(value.currencyCode),
    paymentStatus: value.paymentStatus,
    providerAccountReference: requireString(
      value.providerAccountReference,
      "providerAccountReference",
    ),
    accessToken: normalizeTokenEnvelope(value.accessToken, encryptionKeyVersion),
    encryptionKeyVersion,
  };
}

function normalizeRefund(value: unknown): RefundRecord {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Refund record is malformed",
    );
  }
  if (value.providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Refund provider is invalid",
    );
  }
  const status = value.status;
  if (
    status !== "REQUESTED" &&
    status !== "PENDING" &&
    status !== "SUCCEEDED" &&
    status !== "FAILED"
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Refund status is invalid",
    );
  }
  return {
    id: requireString(value.id, "refundId"),
    paymentAttemptId: requireString(value.paymentAttemptId, "paymentAttemptId"),
    requestNonce: requireString(value.requestNonce, "requestNonce"),
    providerName: MERCADO_PAGO_PROVIDER,
    providerPaymentReference: requireString(
      value.providerPaymentReference,
      "providerPaymentReference",
    ),
    providerRefundReference: requireNullableString(
      value.providerRefundReference,
      "providerRefundReference",
    ),
    amountMinor: requirePositiveInteger(value.amountMinor, "amountMinor"),
    currencyCode: requireCurrency(value.currencyCode),
    status,
    reasonCode: requireNullableString(value.reasonCode, "reasonCode"),
  };
}

function publicRefund(record: RefundRecord): RefundResult {
  return {
    refundId: record.id,
    amountMinor: record.amountMinor,
    currencyCode: record.currencyCode,
    status: record.status,
    providerRefundReference: record.providerRefundReference,
  };
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "payment reconciliation failed";
  return message.replace(/\s+/g, " ").trim().slice(0, 1000) || "payment reconciliation failed";
}

export function createPaymentRefundServer(dependencies: RefundServerDependencies) {
  async function requestPaymentRefund(
    paymentAttemptId: string,
    requestNonce: string,
    requestedAmountMinor?: number,
  ): Promise<RefundResult> {
    const user = await dependencies.getCurrentUser();
    if (!user) {
      throw new PaymentServerError("UNAUTHORIZED", "Authentication is required");
    }
    requireString(paymentAttemptId, "paymentAttemptId");
    requireString(requestNonce, "requestNonce");

    const existingRaw = await dependencies.findRefundByNonce(requestNonce);
    if (existingRaw !== null && existingRaw !== undefined) {
      const existing = normalizeRefund(existingRaw);
      if (
        existing.paymentAttemptId !== paymentAttemptId ||
        (requestedAmountMinor !== undefined && existing.amountMinor !== requestedAmountMinor)
      ) {
        throw new PaymentServerError(
          "CONFLICT",
          "Refund nonce is already bound to another request",
        );
      }
      if (existing.status !== "REQUESTED") return publicRefund(existing);
    }

    const snapshot = normalizeSnapshot(
      await dependencies.loadPaymentRefundSnapshot(paymentAttemptId),
      paymentAttemptId,
    );
    if (snapshot.clientUserId !== user.id) {
      throw new PaymentServerError(
        "FORBIDDEN",
        "Only the payment client can request a refund",
      );
    }

    const amountMinor = requestedAmountMinor ?? snapshot.refundableRemainingMinor;
    if (
      !Number.isSafeInteger(amountMinor) ||
      amountMinor <= 0 ||
      amountMinor > snapshot.refundableRemainingMinor
    ) {
      throw new PaymentServerError(
        "CONFLICT",
        "Refund amount exceeds the durable refundable balance",
      );
    }

    let refund =
      existingRaw === null || existingRaw === undefined
        ? normalizeRefund(
            await dependencies.createRefundRecord({
              paymentAttemptId,
              requestNonce,
              requestedByUserId: user.id,
              amountMinor,
              currencyCode: snapshot.currencyCode,
              status: "REQUESTED",
            }),
          )
        : normalizeRefund(existingRaw);

    const tokenEncryptionKey = resolveValue(dependencies.paymentEnv).tokenEncryptionKey;
    const accessToken = decryptPaymentToken(snapshot.accessToken, tokenEncryptionKey);

    try {
      const providerResult = await dependencies.paymentProvider.refund({
        accessToken,
        paymentId: snapshot.providerPaymentReference,
        idempotencyKey: requestNonce,
        amountMinor: refund.amountMinor,
      });

      refund = normalizeRefund(
        await dependencies.markRefundProviderResult({
          refundId: refund.id,
          providerRefundReference: providerResult.providerRefundReference,
          status: "PENDING",
          reasonCode: null,
          providerEventId: null,
        }),
      );
      return publicRefund(refund);
    } catch (error) {
      try {
        await dependencies.markRefundProviderResult({
          refundId: refund.id,
          providerRefundReference: null,
          status: "FAILED",
          reasonCode: "REFUND_REJECTED",
          providerEventId: null,
        });
      } catch (persistenceError) {
        throw new PaymentServerError(
          "PERSISTENCE_ERROR",
          "Unable to record failed refund request",
          persistenceError,
        );
      }
      throw new PaymentServerError(
        "PROVIDER_UNAVAILABLE",
        "Mercado Pago refund request failed",
        error,
      );
    }
  }

  async function reconcileRefund(
    refundId: string,
    input: RefundReconciliationInput,
  ): Promise<RefundResult> {
    requireString(refundId, "refundId");
    const record = normalizeRefund(
      await dependencies.markRefundProviderResult({
        refundId,
        providerRefundReference: input.providerRefundReference ?? null,
        status: input.status,
        reasonCode: input.reasonCode ?? null,
        providerEventId: input.providerEventId ?? null,
      }),
    );
    return publicRefund(record);
  }

  async function runPaymentReconciliation(
    scope: PaymentReconciliationScope = {},
  ): Promise<ReconciliationCounters & { runId: string }> {
    if (!dependencies.startReconciliationRun || !dependencies.finishReconciliationRun) {
      throw new PaymentServerError(
        "PERSISTENCE_ERROR",
        "Payment reconciliation persistence is unavailable",
      );
    }
    const runId = await dependencies.startReconciliationRun(scope);
    try {
      const counters = dependencies.performReconciliation
        ? await dependencies.performReconciliation(scope)
        : { checkedCount: 0, matchedCount: 0, mismatchedCount: 0, failedCount: 0 };
      await dependencies.finishReconciliationRun({ runId, ...counters });
      return { runId, ...counters };
    } catch (error) {
      await dependencies.finishReconciliationRun({
        runId,
        checkedCount: 0,
        matchedCount: 0,
        mismatchedCount: 0,
        failedCount: 1,
        errorSummary: sanitizeError(error),
      });
      throw error;
    }
  }

  return { requestPaymentRefund, reconcileRefund, runPaymentReconciliation };
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const admin = createAdminClient() as unknown as RpcClient;
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      `Payment refund persistence failed: ${name}`,
      error,
    );
  }
  return data;
}

async function loadPaymentRefundSnapshot(paymentAttemptId: string) {
  return callRpc("get_payment_refund_snapshot", {
    target_payment_attempt_id: paymentAttemptId,
  });
}

async function findRefundByNonce(requestNonce: string) {
  return callRpc("get_payment_refund_by_nonce", {
    refund_request_nonce: requestNonce,
  });
}

async function createRefundRecord(input: {
  paymentAttemptId: string;
  requestNonce: string;
  requestedByUserId: string;
  amountMinor: number;
}) {
  return callRpc("create_payment_refund_request", {
    target_payment_attempt_id: input.paymentAttemptId,
    refund_request_nonce: input.requestNonce,
    requested_by_user_id: input.requestedByUserId,
    requested_amount_minor: input.amountMinor,
  });
}

async function markRefundProviderResult(input: {
  refundId: string;
  providerRefundReference: string | null;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  reasonCode?: string | null;
  providerEventId?: string | null;
}) {
  return callRpc("set_payment_refund_provider_result", {
    target_refund_id: input.refundId,
    payment_provider_refund_reference: input.providerRefundReference,
    target_status: input.status,
    target_reason_code: input.reasonCode ?? null,
    source_provider_event_id: input.providerEventId ?? null,
  });
}

async function startReconciliationRun(scope: PaymentReconciliationScope) {
  const data = await callRpc("start_payment_reconciliation_run", {
    reconciliation_initiated_by_user_id: scope.initiatedByUserId ?? null,
    reconciliation_initiator_type: scope.initiatorType ?? "SYSTEM",
    reconciliation_provider_name: scope.providerName ?? MERCADO_PAGO_PROVIDER,
    reconciliation_range_start: scope.rangeStart ?? null,
    reconciliation_range_end: scope.rangeEnd ?? null,
  });
  return requireString(data, "reconciliationRunId");
}

async function finishReconciliationRun(
  input: ReconciliationCounters & { runId: string; errorSummary?: string | null },
) {
  await callRpc("finish_payment_reconciliation_run", {
    target_run_id: input.runId,
    target_checked_count: input.checkedCount,
    target_matched_count: input.matchedCount,
    target_mismatched_count: input.mismatchedCount,
    target_failed_count: input.failedCount,
    target_error_summary: input.errorSummary ?? null,
  });
}

let defaultRefundServer: ReturnType<typeof createPaymentRefundServer> | null = null;

function getDefaultRefundServer() {
  if (defaultRefundServer) return defaultRefundServer;
  defaultRefundServer = createPaymentRefundServer({
    paymentEnv: getPaymentServerEnv,
    getCurrentUser,
    loadPaymentRefundSnapshot,
    findRefundByNonce,
    createRefundRecord,
    markRefundProviderResult,
    startReconciliationRun,
    finishReconciliationRun,
    paymentProvider: {
      async refund(input) {
        const env = getPaymentServerEnv();
        const provider = new MercadoPagoPaymentProvider({
          clientId: env.clientId,
          clientSecret: env.clientSecret,
          webhookSecret: env.webhookSecret,
        });
        return provider.refund(input);
      },
    },
  });
  return defaultRefundServer;
}

export async function requestPaymentRefund(
  paymentAttemptId: string,
  requestNonce: string,
  requestedAmountMinor?: number,
) {
  return getDefaultRefundServer().requestPaymentRefund(
    paymentAttemptId,
    requestNonce,
    requestedAmountMinor,
  );
}

export async function reconcileRefund(
  refundId: string,
  input: RefundReconciliationInput,
) {
  return getDefaultRefundServer().reconcileRefund(refundId, input);
}

export async function runPaymentReconciliation(
  scope: PaymentReconciliationScope = {},
) {
  return getDefaultRefundServer().runPaymentReconciliation(scope);
}
