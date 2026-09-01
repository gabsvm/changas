import "server-only";

import type { JobStatus, ScheduleType } from "@changas/domain";
import { jobStatuses, scheduleTypes } from "@changas/domain";

import { createFakeAdditionalPaymentRecord } from "@/lib/jobs/payment-adapter";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type JobErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TRANSIENT";

export class JobServerError extends Error {
  constructor(
    public readonly code: JobErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JobServerError";
  }
}

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

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

export async function listMyUpcomingJobs(limit = 20): Promise<UpcomingJob[]> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("list_my_upcoming_jobs", {
    limit_count: Math.min(Math.max(limit, 1), 50),
  });
  if (error) throw mapError(error.code);
  const rows = requireRows<UpcomingJob>(data);
  return rows.filter(
    (row) =>
      isUuid(row.job_id) &&
      jobStatuses.includes(row.job_status) &&
      scheduleTypes.includes(row.schedule_type),
  );
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
  return row;
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

export async function applyFakeAdditionalPayment(input: {
  jobId: string;
  scopeChangeId: string;
  nonce: string;
  outcome: "SUCCESS" | "PENDING" | "FAILURE";
}): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new JobServerError(
      "FORBIDDEN",
      "Los pagos de prueba no están disponibles en producción.",
    );
  }

  const { user } = await authenticatedClient();
  const scopeChanges = await listJobScopeChanges(input.jobId);
  const targetChange = scopeChanges.find(
    (change) => change.scope_change_id === input.scopeChangeId,
  );
  if (!targetChange) {
    throw new JobServerError("NOT_FOUND", "No encontramos ese cambio de alcance.");
  }
  if (
    targetChange.change_status !== "AWAITING_PAYMENT" &&
    targetChange.change_status !== "PAYMENT_FAILED"
  ) {
    throw new JobServerError("CONFLICT", "El cambio de alcance ya no admite pago.");
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
