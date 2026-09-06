import "server-only";

import { createClient } from "@/lib/supabase/server";

import { PaymentServerError } from "./server";
import {
  runAuthoritativePaymentReconciliation,
  type PaymentReconciliationResult,
  type PaymentReconciliationScope,
} from "./server-reconciliation";

const MERCADO_PAGO_PROVIDER = "MERCADO_PAGO" as const;

type User = { id: string };
type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
type RpcClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

export type AdminPaymentRow = {
  paymentAttemptId: string;
  proposalId: string;
  clientUserId: string;
  providerUserId: string;
  providerName: string;
  providerReference: string;
  localStatus: string;
  providerStatus: string | null;
  grossMinor: number;
  marketplaceFeeMinor: number;
  providerExpectedNetMinor: number;
  providerFeeMinor: number | null;
  providerNetReceivedMinor: number | null;
  settlementStatus: string | null;
  refundStatus: string | null;
  refundedMinor: number;
  mismatchFlag: boolean;
  lastReconciledAt: string | null;
};

export type AdminReconciliationRun = {
  runId: string;
  initiatorType: string;
  providerName: string | null;
  checkedCount: number;
  matchedCount: number;
  mismatchedCount: number;
  failedCount: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
};

export type PaymentReceipt = {
  paymentAttemptId: string;
  providerName: string;
  providerReference: string;
  externalReference: string;
  amountMinor: number;
  currencyCode: string;
  status: string;
  refundedMinor: number;
  createdAt: string;
};

type AdminDependencies = {
  getCurrentUser: () => Promise<User | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  listPaymentRows: () => Promise<unknown>;
  listReconciliationRuns: () => Promise<unknown>;
  runReconciliation: (
    scope: PaymentReconciliationScope,
  ) => Promise<PaymentReconciliationResult>;
};

type ReceiptDependencies = {
  getCurrentUser: () => Promise<User | null>;
  loadPaymentReceipt: (paymentAttemptId: string) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(row: Record<string, unknown>, camel: string, snake: string) {
  return row[camel] ?? row[snake];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid payment admin field: ${field}`,
    );
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : requiredString(value, "nullableString");
}

function integer(value: unknown, field: string): number {
  const normalized = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid payment admin amount: ${field}`,
    );
  }
  return normalized;
}

function nullableInteger(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : integer(value, field);
}

function normalizeAdminPayment(value: unknown): AdminPaymentRow {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Admin payment row is malformed",
    );
  }
  return {
    paymentAttemptId: requiredString(
      pick(value, "paymentAttemptId", "payment_attempt_id"),
      "paymentAttemptId",
    ),
    proposalId: requiredString(
      pick(value, "proposalId", "proposal_id"),
      "proposalId",
    ),
    clientUserId: requiredString(
      pick(value, "clientUserId", "client_user_id"),
      "clientUserId",
    ),
    providerUserId: requiredString(
      pick(value, "providerUserId", "provider_user_id"),
      "providerUserId",
    ),
    providerName: requiredString(
      pick(value, "providerName", "provider_name"),
      "providerName",
    ),
    providerReference: requiredString(
      pick(value, "providerReference", "provider_reference"),
      "providerReference",
    ),
    localStatus: requiredString(
      pick(value, "localStatus", "local_status"),
      "localStatus",
    ),
    providerStatus: nullableString(
      pick(value, "providerStatus", "provider_status"),
    ),
    grossMinor: integer(pick(value, "grossMinor", "gross_minor"), "grossMinor"),
    marketplaceFeeMinor: integer(
      pick(value, "marketplaceFeeMinor", "marketplace_fee_minor"),
      "marketplaceFeeMinor",
    ),
    providerExpectedNetMinor: integer(
      pick(value, "providerExpectedNetMinor", "provider_expected_net_minor"),
      "providerExpectedNetMinor",
    ),
    providerFeeMinor: nullableInteger(
      pick(value, "providerFeeMinor", "provider_fee_minor"),
      "providerFeeMinor",
    ),
    providerNetReceivedMinor: nullableInteger(
      pick(value, "providerNetReceivedMinor", "provider_net_received_minor"),
      "providerNetReceivedMinor",
    ),
    settlementStatus: nullableString(
      pick(value, "settlementStatus", "settlement_status"),
    ),
    refundStatus: nullableString(
      pick(value, "refundStatus", "refund_status"),
    ),
    refundedMinor: integer(
      pick(value, "refundedMinor", "refunded_minor"),
      "refundedMinor",
    ),
    mismatchFlag:
      pick(value, "mismatchFlag", "mismatch_flag") === true,
    lastReconciledAt: nullableString(
      pick(value, "lastReconciledAt", "last_reconciled_at"),
    ),
  };
}

function normalizeRun(value: unknown): AdminReconciliationRun {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment reconciliation run is malformed",
    );
  }
  return {
    runId: requiredString(pick(value, "runId", "run_id"), "runId"),
    initiatorType: requiredString(
      pick(value, "initiatorType", "initiator_type"),
      "initiatorType",
    ),
    providerName: nullableString(pick(value, "providerName", "provider_name")),
    checkedCount: integer(
      pick(value, "checkedCount", "checked_count"),
      "checkedCount",
    ),
    matchedCount: integer(
      pick(value, "matchedCount", "matched_count"),
      "matchedCount",
    ),
    mismatchedCount: integer(
      pick(value, "mismatchedCount", "mismatched_count"),
      "mismatchedCount",
    ),
    failedCount: integer(
      pick(value, "failedCount", "failed_count"),
      "failedCount",
    ),
    status: requiredString(value.status, "status"),
    startedAt: requiredString(pick(value, "startedAt", "started_at"), "startedAt"),
    finishedAt: nullableString(pick(value, "finishedAt", "finished_at")),
    errorSummary: nullableString(pick(value, "errorSummary", "error_summary")),
  };
}

function normalizeReceipt(value: unknown): PaymentReceipt & {
  clientUserId: string;
  providerUserId: string;
} {
  if (!isRecord(value)) {
    throw new PaymentServerError("NOT_FOUND", "Payment receipt was not found");
  }
  return {
    paymentAttemptId: requiredString(
      pick(value, "paymentAttemptId", "payment_attempt_id"),
      "paymentAttemptId",
    ),
    clientUserId: requiredString(
      pick(value, "clientUserId", "client_user_id"),
      "clientUserId",
    ),
    providerUserId: requiredString(
      pick(value, "providerUserId", "provider_user_id"),
      "providerUserId",
    ),
    providerName: requiredString(
      pick(value, "providerName", "provider_name"),
      "providerName",
    ),
    providerReference: requiredString(
      pick(value, "providerReference", "provider_reference"),
      "providerReference",
    ),
    externalReference: requiredString(
      pick(value, "externalReference", "external_reference"),
      "externalReference",
    ),
    amountMinor: integer(pick(value, "amountMinor", "amount_minor"), "amountMinor"),
    currencyCode: requiredString(
      pick(value, "currencyCode", "currency_code"),
      "currencyCode",
    ),
    status: requiredString(value.status, "status"),
    refundedMinor: integer(
      pick(value, "refundedMinor", "refunded_minor"),
      "refundedMinor",
    ),
    createdAt: requiredString(pick(value, "createdAt", "created_at"), "createdAt"),
  };
}

async function requireAdmin(dependencies: AdminDependencies) {
  const user = await dependencies.getCurrentUser();
  if (!user) {
    throw new PaymentServerError("UNAUTHORIZED", "Authentication required");
  }
  if (!(await dependencies.isAdmin(user.id))) {
    throw new PaymentServerError("FORBIDDEN", "Admin access required");
  }
  return user;
}

export function createPaymentAdminServer(dependencies: AdminDependencies) {
  async function listAdminPayments() {
    await requireAdmin(dependencies);
    const [paymentRows, reconciliationRows] = await Promise.all([
      dependencies.listPaymentRows(),
      dependencies.listReconciliationRuns(),
    ]);
    if (!Array.isArray(paymentRows) || !Array.isArray(reconciliationRows)) {
      throw new PaymentServerError(
        "PERSISTENCE_ERROR",
        "Payment admin read model is malformed",
      );
    }
    return {
      payments: paymentRows.map(normalizeAdminPayment),
      runs: reconciliationRows.map(normalizeRun),
    };
  }

  async function runAdminPaymentReconciliation() {
    const user = await requireAdmin(dependencies);
    return dependencies.runReconciliation({
      initiatedByUserId: user.id,
      initiatorType: "ADMIN",
      providerName: MERCADO_PAGO_PROVIDER,
    });
  }

  return { listAdminPayments, runAdminPaymentReconciliation };
}

export function createPaymentReceiptServer(dependencies: ReceiptDependencies) {
  async function getMyPaymentReceipt(paymentAttemptId: string) {
    const user = await dependencies.getCurrentUser();
    if (!user) {
      throw new PaymentServerError("UNAUTHORIZED", "Authentication required");
    }
    const internal = normalizeReceipt(
      await dependencies.loadPaymentReceipt(paymentAttemptId),
    );
    if (
      user.id !== internal.clientUserId &&
      user.id !== internal.providerUserId
    ) {
      throw new PaymentServerError("FORBIDDEN", "Payment receipt access denied");
    }
    const { clientUserId: _client, providerUserId: _provider, ...safe } = internal;
    return safe;
  }

  return { getMyPaymentReceipt };
}

async function currentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

async function userRpc(name: string, args: Record<string, unknown> = {}) {
  const supabase = (await createClient()) as unknown as RpcClient;
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw new PaymentServerError(
      error.code === "42501" ? "FORBIDDEN" : "PERSISTENCE_ERROR",
      `Payment RPC failed: ${name}`,
      error,
    );
  }
  return data;
}

const defaultAdminServer = createPaymentAdminServer({
  getCurrentUser: currentUser,
  isAdmin: async () => (await userRpc("is_current_user_admin")) === true,
  listPaymentRows: async () =>
    userRpc("list_admin_payment_finance", { page_size: 50, page_offset: 0 }),
  listReconciliationRuns: async () =>
    userRpc("list_admin_payment_reconciliation_runs", { page_size: 20 }),
  runReconciliation: runAuthoritativePaymentReconciliation,
});

const defaultReceiptServer = createPaymentReceiptServer({
  getCurrentUser: currentUser,
  loadPaymentReceipt: async (paymentAttemptId) =>
    userRpc("get_my_payment_receipt", {
      target_payment_attempt_id: paymentAttemptId,
    }),
});

export async function listAdminPayments() {
  return defaultAdminServer.listAdminPayments();
}

export async function runAdminPaymentReconciliation() {
  return defaultAdminServer.runAdminPaymentReconciliation();
}

export async function getMyPaymentReceipt(paymentAttemptId: string) {
  return defaultReceiptServer.getMyPaymentReceipt(paymentAttemptId);
}
