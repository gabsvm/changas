import "server-only";

import type { JobStatus, ScheduleType } from "@changas/domain";
import { jobStatuses, scheduleTypes } from "@changas/domain";
import { isUuid } from "@changas/validation";

import {
  createFakeAdditionalPaymentRecord,
  createFakeSettlementPaymentRecord,
} from "@/lib/jobs/payment-adapter";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type JobErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TRANSIENT";

export class JobServerError extends Error {
  constructor(
    public readonly code: JobErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JobServerError";
  }
}

export type SettlementStatus = "NOT_DUE" | "DUE" | "SETTLED" | "NOT_REQUIRED";

export type UpcomingJob = {
  job_id: string;
  job_status: JobStatus;
  service_title: string;
  counterparty_name: string;
  schedule_type: ScheduleType;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  updated_at: string;
  base_price_amount: number | null;
  paid_additional_amount: number | null;
  total_price_amount: number | null;
  currency_code: string | null;
  is_client: boolean | null;
  settlement_status: SettlementStatus | null;
  settlement_total_minor: number | null;
};

export type JobDetail = {
  job_id: string;
  conversation_id: string;
  job_status: JobStatus;
  client_user_id: string;
  provider_user_id: string;
  service_id: string;
  service_title: string;
  scope_snapshot: string;
  base_price_amount: number;
  paid_additional_amount: number;
  total_price_amount: number;
  currency_code: string;
  modality: "IN_PERSON" | "REMOTE" | "BOTH";
  schedule_type: ScheduleType;
  schedule_starts_at: string | null;
  schedule_ends_at: string | null;
  schedule_deadline_at: string | null;
  expected_duration_minutes: number | null;
  counterparty_name: string;
  exact_address: string | null;
  exact_latitude: number | null;
  exact_longitude: number | null;
  access_notes: string | null;
  confirmed_at: string;
  updated_at: string;
  settlement_status: SettlementStatus;
  settlement_total_minor: number;
  settlement_unpaid_extras_minor: number;
  settlement_unpaid_extra_ids: string[];
};

export type JobEvent = {
  event_id: string;
  actor_user_id: string | null;
  event_type: string;
  from_status: JobStatus | null;
  to_status: JobStatus | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type JobRescheduleRequest = {
  request_id: string;
  requested_by_user_id: string;
  request_status: "OPEN" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  schedule_type: ScheduleType;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  expected_duration_minutes: number | null;
  reason: string | null;
  responded_by_user_id: string | null;
  responded_at: string | null;
  created_at: string;
};

export type JobScopeChange = {
  scope_change_id: string;
  requested_by_user_id: string;
  change_status:
    | "OPEN"
    | "REJECTED"
    | "WITHDRAWN"
    | "AWAITING_PAYMENT"
    | "PAYMENT_FAILED"
    | "PAID";
  scope_snapshot: string;
  additional_amount_minor: number;
  currency_code: string;
  client_responded_at: string | null;
  created_at: string;
  updated_at: string;
};

type RpcError = { code?: string | null } | null;
type RpcResult<T> = Promise<{ data: T | null; error: RpcError }>;
type JobsRpcClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResult<unknown>;
};

function mapError(code?: string | null): JobServerError {
  switch (code) {
    case "42501":
      return new JobServerError(
        "FORBIDDEN",
        "No tenés permiso para esa acción.",
      );
    case "P0002":
      return new JobServerError("NOT_FOUND", "No encontramos ese trabajo.");
    case "22023":
    case "23505":
    case "23P01":
    case "40001":
      return new JobServerError(
        "CONFLICT",
        "El trabajo cambió o el horario ya no está disponible. Actualizá e intentá nuevamente.",
      );
    default:
      return new JobServerError(
        "TRANSIENT",
        "No pudimos completar la acción. Intentá nuevamente.",
      );
  }
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobServerError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para administrar trabajos.",
    );
  }
  return { supabase: supabase as unknown as JobsRpcClient, user };
}

function requireRows<T>(value: unknown): T[] {
  if (!Array.isArray(value))
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  return value as T[];
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSettlementStatus(value: unknown): SettlementStatus | null {
  return value === "NOT_DUE" ||
    value === "DUE" ||
    value === "SETTLED" ||
    value === "NOT_REQUIRED"
    ? value
    : null;
}

function normalizeUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && isUuid(entry),
  );
}

function normalizeJobRow(row: UpcomingJob): UpcomingJob {
  return {
    ...row,
    base_price_amount: finiteNumberOrNull(row.base_price_amount),
    paid_additional_amount: finiteNumberOrNull(row.paid_additional_amount),
    total_price_amount: finiteNumberOrNull(row.total_price_amount),
    currency_code:
      typeof row.currency_code === "string" ? row.currency_code : null,
    is_client: typeof row.is_client === "boolean" ? row.is_client : null,
    settlement_status: normalizeSettlementStatus(row.settlement_status),
    settlement_total_minor: finiteNumberOrNull(row.settlement_total_minor),
  };
}

function filterValidJobRows(rows: UpcomingJob[]): UpcomingJob[] {
  return rows
    .filter(
      (row) =>
        isUuid(row.job_id) &&
        jobStatuses.includes(row.job_status) &&
        scheduleTypes.includes(row.schedule_type),
    )
    .map(normalizeJobRow);
}

export async function listMyUpcomingJobs(limit = 20): Promise<UpcomingJob[]> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_my_upcoming_jobs", {
    limit_count: Math.min(Math.max(limit, 1), 50),
  });
  if (error) throw mapError(error.code);
  return filterValidJobRows(requireRows<UpcomingJob>(data));
}

export async function listMyPastJobs(limit = 20): Promise<UpcomingJob[]> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_my_past_jobs", {
    limit_count: Math.min(Math.max(limit, 1), 50),
  });
  if (error) throw mapError(error.code);
  return filterValidJobRows(requireRows<UpcomingJob>(data));
}

export async function getJobDetail(jobId: string): Promise<JobDetail> {
  if (!isUuid(jobId))
    throw new JobServerError("NOT_FOUND", "Trabajo inválido.");
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("get_job_detail", {
    target_job_id: jobId,
  });
  if (error) throw mapError(error.code);
  const row = requireRows<JobDetail>(data)[0];
  if (!row || !isUuid(row.job_id) || !jobStatuses.includes(row.job_status)) {
    throw new JobServerError("NOT_FOUND", "No encontramos ese trabajo.");
  }
  // Totals land with the paid-totals migration; fall back to base + paid
  // so the page survives any deploy/migration ordering.
  const paid =
    typeof row.paid_additional_amount === "number" &&
    Number.isFinite(row.paid_additional_amount)
      ? row.paid_additional_amount
      : 0;
  const total =
    typeof row.total_price_amount === "number" &&
    Number.isFinite(row.total_price_amount)
      ? row.total_price_amount
      : row.base_price_amount + paid;
  // Settlement lands with the job-settlement migration; default to NOT_DUE
  // so the pay affordance stays hidden until the columns exist.
  const settlementStatus =
    normalizeSettlementStatus(row.settlement_status) ?? "NOT_DUE";
  const settlementTotal =
    typeof row.settlement_total_minor === "number" &&
    Number.isFinite(row.settlement_total_minor)
      ? row.settlement_total_minor
      : row.base_price_amount;
  const settlementExtras =
    typeof row.settlement_unpaid_extras_minor === "number" &&
    Number.isFinite(row.settlement_unpaid_extras_minor)
      ? row.settlement_unpaid_extras_minor
      : 0;
  return {
    ...row,
    paid_additional_amount: paid,
    total_price_amount: total,
    settlement_status: settlementStatus,
    settlement_total_minor: settlementTotal,
    settlement_unpaid_extras_minor: settlementExtras,
    settlement_unpaid_extra_ids: normalizeUuidList(
      row.settlement_unpaid_extra_ids,
    ),
  };
}

export type ConversationJob = {
  job_id: string;
  accepted_proposal_version_id: string;
  job_status: JobStatus;
};

export async function listConversationJobs(
  conversationId: string,
): Promise<ConversationJob[]> {
  if (!isUuid(conversationId)) return [];
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_conversation_jobs", {
    target_conversation_id: conversationId,
  });
  if (error) throw mapError(error.code);
  return requireRows<ConversationJob>(data).filter(
    (row) =>
      isUuid(row.job_id) &&
      isUuid(row.accepted_proposal_version_id) &&
      jobStatuses.includes(row.job_status),
  );
}

export async function listJobEvents(jobId: string): Promise<JobEvent[]> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_job_events", {
    target_job_id: jobId,
    limit_count: 200,
  });
  if (error) throw mapError(error.code);
  return requireRows<JobEvent>(data);
}

export async function listJobRescheduleRequests(
  jobId: string,
): Promise<JobRescheduleRequest[]> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_job_reschedule_requests", {
    target_job_id: jobId,
  });
  if (error) throw mapError(error.code);
  return requireRows<JobRescheduleRequest>(data);
}

export async function listJobScopeChanges(
  jobId: string,
): Promise<JobScopeChange[]> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_job_scope_changes", {
    target_job_id: jobId,
  });
  if (error) throw mapError(error.code);
  return requireRows<JobScopeChange>(data);
}

export async function transitionJob(
  jobId: string,
  expectedStatus: JobStatus,
  requestedStatus: JobStatus,
  reason?: string | null,
): Promise<JobStatus> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: expectedStatus,
    requested_status: requestedStatus,
    transition_reason: reason?.trim() || null,
  });
  if (error) throw mapError(error.code);
  if (typeof data !== "string" || !jobStatuses.includes(data as JobStatus)) {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
  return data as JobStatus;
}

export async function requestJobReschedule(input: {
  jobId: string;
  scheduleType: ScheduleType;
  startsAt?: string | null;
  endsAt?: string | null;
  deadlineAt?: string | null;
  durationMinutes?: number | null;
  reason?: string | null;
}): Promise<string> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("request_job_reschedule", {
    target_job_id: input.jobId,
    requested_schedule_type: input.scheduleType,
    requested_starts_at: input.startsAt ?? null,
    requested_ends_at: input.endsAt ?? null,
    requested_deadline_at: input.deadlineAt ?? null,
    requested_duration_minutes: input.durationMinutes ?? null,
    request_reason: input.reason?.trim() || null,
  });
  if (error) throw mapError(error.code);
  if (!isUuid(data))
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  return data;
}

export async function respondJobReschedule(
  requestId: string,
  action: "ACCEPT" | "REJECT",
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("respond_job_reschedule", {
    target_request_id: requestId,
    response_action: action,
  });
  if (error) throw mapError(error.code);
}

export async function requestJobScopeChange(
  jobId: string,
  scopeText: string,
  additionalAmountMinor: number,
): Promise<string> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("request_job_scope_change", {
    target_job_id: jobId,
    new_scope_text: scopeText.trim(),
    additional_amount_minor: additionalAmountMinor,
  });
  if (error) throw mapError(error.code);
  if (!isUuid(data))
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  return data;
}

export async function respondJobScopeChange(
  scopeChangeId: string,
  action: "ACCEPT" | "REJECT",
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("respond_job_scope_change", {
    target_scope_change_id: scopeChangeId,
    response_action: action,
  });
  if (error) throw mapError(error.code);
}

export async function setJobExactLocation(input: {
  jobId: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("set_job_exact_location", {
    target_job_id: input.jobId,
    exact_address_text: input.address.trim(),
    lat: input.latitude ?? null,
    lng: input.longitude ?? null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw mapError(error.code);
}

async function requireFakePaymentAllowed(
  supabase: JobsRpcClient,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  // Test affordance: admins resolve payments without money so the full
  // hire flow stays testable in production.
  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_current_user_admin",
  );
  if (adminError || isAdmin !== true) {
    throw new JobServerError(
      "FORBIDDEN",
      "Los pagos de prueba no están disponibles en producción.",
    );
  }
}

export async function applyFakeAdditionalPayment(input: {
  jobId: string;
  scopeChangeId: string;
  nonce: string;
  outcome: "SUCCESS" | "PENDING" | "FAILURE";
}): Promise<void> {
  const { supabase, user } = await authenticatedClient();
  await requireFakePaymentAllowed(supabase);
  const scopeChanges = await listJobScopeChanges(input.jobId);
  const targetChange = scopeChanges.find(
    (change) => change.scope_change_id === input.scopeChangeId,
  );
  if (!targetChange) {
    throw new JobServerError(
      "NOT_FOUND",
      "No encontramos ese cambio de alcance.",
    );
  }
  if (
    targetChange.change_status !== "AWAITING_PAYMENT" &&
    targetChange.change_status !== "PAYMENT_FAILED"
  ) {
    throw new JobServerError(
      "CONFLICT",
      "El cambio de alcance ya no admite pago.",
    );
  }

  const payment = await createFakeAdditionalPaymentRecord({
    paymentNonce: input.nonce,
    amountMinor: targetChange.additional_amount_minor,
    currencyCode: targetChange.currency_code,
    outcome: input.outcome,
  });

  const admin = createAdminClient() as unknown as JobsRpcClient;
  const { error } = await admin.rpc("apply_additional_payment_result", {
    target_scope_change_id: input.scopeChangeId,
    payment_nonce: input.nonce,
    payment_provider_name: "FAKE",
    payment_provider_reference: payment.id,
    payment_result_status: payment.status,
    actor_client_user_id: user.id,
  });
  if (error) throw mapError(error.code);
}
export async function applyFakeSettlementPayment(input: {
  jobId: string;
  nonce: string;
  outcome: "SUCCESS" | "PENDING" | "FAILURE";
}): Promise<void> {
  const { supabase, user } = await authenticatedClient();
  await requireFakePaymentAllowed(supabase);

  const detail = await getJobDetail(input.jobId);
  if (detail.job_status !== "COMPLETED") {
    throw new JobServerError("CONFLICT", "El trabajo aún no está completo.");
  }
  if (detail.settlement_status !== "DUE") {
    throw new JobServerError("CONFLICT", "El trabajo no admite cobro.");
  }

  const payment = await createFakeSettlementPaymentRecord({
    paymentNonce: input.nonce,
    amountMinor: detail.settlement_total_minor,
    currencyCode: detail.currency_code,
    outcome: input.outcome,
  });

  const admin = createAdminClient() as unknown as JobsRpcClient;
  const { error } = await admin.rpc("apply_job_settlement_result", {
    target_job_id: input.jobId,
    settlement_nonce: input.nonce,
    settlement_provider_name: "FAKE",
    settlement_provider_reference: payment.id,
    settlement_result_status: payment.status,
    settlement_actor_user_id: user.id,
    included_scope_change_ids: detail.settlement_unpaid_extra_ids,
    assert_total_minor: detail.settlement_total_minor,
  });
  if (error) throw mapError(error.code);
}
