import "server-only";

import { getPaymentServerEnv } from "@changas/config/server";

import { createAdminClient } from "@/lib/supabase/admin";

import { decryptPaymentToken, type PaymentTokenEnvelope } from "./crypto";
import { MercadoPagoPaymentProvider } from "./mercado-pago";
import { PaymentServerError } from "./server";
import type { AuthoritativeProviderPayment } from "./types";

const MERCADO_PAGO_PROVIDER = "MERCADO_PAGO" as const;

export type PaymentReconciliationScope = {
  initiatedByUserId?: string | null;
  initiatorType?: "ADMIN" | "SYSTEM";
  providerName?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
};

export type PaymentReconciliationResult = {
  runId: string;
  checkedCount: number;
  matchedCount: number;
  mismatchedCount: number;
  failedCount: number;
};

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

type RpcClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

type Candidate = {
  checkoutSessionId: string;
  paymentAttemptId: string | null;
  additionalPaymentAttemptId: string | null;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerPaymentReference: string;
  localStatus: string;
  amountMinor: number;
  currencyCode: string;
  externalReference: string;
  providerAccountReference: string;
  accessToken: PaymentTokenEnvelope;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(value: Record<string, unknown>, camel: string, snake: string) {
  return value[camel] ?? value[snake];
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid reconciliation field: ${field}`,
    );
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : requireString(value, "id");
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid reconciliation amount: ${field}`,
    );
  }
  return numberValue;
}

function normalizeCandidate(value: unknown): Candidate {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment reconciliation candidate is malformed",
    );
  }
  const providerName = pick(value, "providerName", "provider_name");
  if (providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Unsupported reconciliation provider",
    );
  }
  const keyVersion = requireNonNegativeInteger(
    pick(value, "encryptionKeyVersion", "encryption_key_version"),
    "encryptionKeyVersion",
  );
  if (keyVersion <= 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment token key version is invalid",
    );
  }
  return {
    checkoutSessionId: requireString(
      pick(value, "checkoutSessionId", "checkout_session_id"),
      "checkoutSessionId",
    ),
    paymentAttemptId: nullableString(
      pick(value, "paymentAttemptId", "payment_attempt_id"),
    ),
    additionalPaymentAttemptId: nullableString(
      pick(
        value,
        "additionalPaymentAttemptId",
        "additional_payment_attempt_id",
      ),
    ),
    providerName,
    providerPaymentReference: requireString(
      pick(value, "providerPaymentReference", "provider_payment_reference"),
      "providerPaymentReference",
    ),
    localStatus: requireString(
      pick(value, "localStatus", "local_status"),
      "localStatus",
    ),
    amountMinor: requireNonNegativeInteger(
      pick(value, "amountMinor", "amount_minor"),
      "amountMinor",
    ),
    currencyCode: requireString(
      pick(value, "currencyCode", "currency_code"),
      "currencyCode",
    ),
    externalReference: requireString(
      pick(value, "externalReference", "external_reference"),
      "externalReference",
    ),
    providerAccountReference: requireString(
      pick(value, "providerAccountReference", "provider_account_reference"),
      "providerAccountReference",
    ),
    accessToken: {
      ciphertext: requireString(
        pick(value, "accessTokenCiphertext", "access_token_ciphertext"),
        "accessTokenCiphertext",
      ),
      iv: requireString(
        pick(value, "accessTokenIv", "access_token_iv"),
        "accessTokenIv",
      ),
      authTag: requireString(
        pick(value, "accessTokenAuthTag", "access_token_auth_tag"),
        "accessTokenAuthTag",
      ),
      keyVersion,
    },
  };
}

async function callRpc(name: string, args: Record<string, unknown> = {}) {
  const admin = createAdminClient() as unknown as RpcClient;
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      `Payment reconciliation persistence failed: ${name}`,
      error,
    );
  }
  return data;
}

function requireRunId(value: unknown): string {
  return requireString(value, "reconciliationRunId");
}

async function observe(
  candidate: Candidate,
  payment: AuthoritativeProviderPayment,
): Promise<boolean> {
  const result = await callRpc("record_payment_reconciliation_observation", {
    target_checkout_session_id: candidate.checkoutSessionId,
    observed_provider_status: payment.status,
    observed_provider_status_detail: payment.statusDetail,
    observed_amount_minor: payment.amountMinor,
    observed_currency_code: payment.currencyCode,
    observed_provider_account_reference: payment.providerAccountReference,
    observed_refunded_minor: payment.refundedAmountMinor,
    observed_provider_net_received_minor: payment.providerNetReceivedMinor,
  });
  if (typeof result !== "boolean") {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Payment reconciliation observation returned an invalid result",
    );
  }
  return result;
}

export async function runAuthoritativePaymentReconciliation(
  scope: PaymentReconciliationScope = {},
): Promise<PaymentReconciliationResult> {
  const env = getPaymentServerEnv();
  const providerName = scope.providerName ?? MERCADO_PAGO_PROVIDER;
  if (providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Unsupported payment reconciliation provider",
    );
  }

  const runId = requireRunId(
    await callRpc("start_payment_reconciliation_run", {
      reconciliation_initiated_by_user_id: scope.initiatedByUserId ?? null,
      reconciliation_initiator_type: scope.initiatorType ?? "SYSTEM",
      reconciliation_provider_name: providerName,
      reconciliation_range_start: scope.rangeStart ?? null,
      reconciliation_range_end: scope.rangeEnd ?? null,
    }),
  );

  const counters = {
    checkedCount: 0,
    matchedCount: 0,
    mismatchedCount: 0,
    failedCount: 0,
  };

  try {
    const rawCandidates = await callRpc(
      "list_payment_reconciliation_candidates",
      {
        reconciliation_provider_name: providerName,
        reconciliation_range_start: scope.rangeStart ?? null,
        reconciliation_range_end: scope.rangeEnd ?? null,
      },
    );
    if (!Array.isArray(rawCandidates)) {
      throw new PaymentServerError(
        "PERSISTENCE_ERROR",
        "Payment reconciliation candidates are malformed",
      );
    }

    const provider = new MercadoPagoPaymentProvider({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      webhookSecret: env.webhookSecret,
    });

    for (const rawCandidate of rawCandidates) {
      const candidate = normalizeCandidate(rawCandidate);
      let authoritative: AuthoritativeProviderPayment | null = null;
      try {
        authoritative = await provider.fetchPayment({
          accessToken: decryptPaymentToken(
            candidate.accessToken,
            env.tokenEncryptionKey,
          ),
          paymentId: candidate.providerPaymentReference,
        });
        counters.checkedCount += 1;

        if (authoritative.externalReference !== candidate.externalReference) {
          counters.mismatchedCount += 1;
          continue;
        }

        if (
          authoritative.status === "PENDING" ||
          authoritative.status === "SUCCEEDED" ||
          authoritative.status === "FAILED"
        ) {
          await callRpc("reconcile_provider_payment", {
            target_checkout_session_id: candidate.checkoutSessionId,
            payment_provider_name: candidate.providerName,
            payment_provider_reference: authoritative.providerPaymentReference,
            payment_result_status: authoritative.status,
            payment_amount_minor: authoritative.amountMinor,
            payment_currency_code: authoritative.currencyCode,
            payment_provider_account_reference:
              authoritative.providerAccountReference,
            source_provider_event_id: null,
          });
        }

        const mismatch = await observe(candidate, authoritative);
        if (mismatch) counters.mismatchedCount += 1;
        else counters.matchedCount += 1;
      } catch {
        if (authoritative) {
          try {
            const mismatch = await observe(candidate, authoritative);
            if (mismatch) counters.mismatchedCount += 1;
            else counters.failedCount += 1;
          } catch {
            counters.failedCount += 1;
          }
        } else {
          counters.failedCount += 1;
        }
      }
    }

    await callRpc("finish_payment_reconciliation_run", {
      target_run_id: runId,
      target_checked_count: counters.checkedCount,
      target_matched_count: counters.matchedCount,
      target_mismatched_count: counters.mismatchedCount,
      target_failed_count: counters.failedCount,
      target_error_summary: null,
    });

    return { runId, ...counters };
  } catch (error) {
    await callRpc("finish_payment_reconciliation_run", {
      target_run_id: runId,
      target_checked_count: counters.checkedCount,
      target_matched_count: counters.matchedCount,
      target_mismatched_count: counters.mismatchedCount,
      target_failed_count: counters.failedCount + 1,
      target_error_summary:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Reconciliation failed",
    });
    throw error;
  }
}
