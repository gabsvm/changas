import "server-only";

import type { JobStatus, ScheduleType } from "@changas/domain";
import { jobStatuses, scheduleTypes } from "@changas/domain";
import { isUuid } from "@changas/validation";

import {
  accumulateThrough,
  type PagedResult,
  type PageKey,
} from "@/lib/cursor-pages";
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

export type JobStatusFilter =
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "CLOSING"
  | "PENDING_SETTLEMENT";

export type JobCursor = {
  beforeSortKey?: string;
  beforeUpdatedAt?: string;
  beforeId?: string;
};

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
  sort_key: string | null;
};

export type JobDetail = {
  /** Schema capability: false on the legacy production DB before S3. */
  delivery_flow_available: boolean;
  confirmation_code: string | null;
  delivery_submitted_at: string | null;
  delivery_summary: string | null;
  delivery_evidence_url: string | null;
  handover_verified_at: string | null;
  correction_count: number;
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
  completion_requested_at: string | null;
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
  response_reason: string | null;
  client_responded_at: string | null;
  created_at: string;
  updated_at: string;
};

type RpcError = { code?: string | null; message?: string | null } | null;
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

function mapTransitionError(
  code?: string | null,
  message?: string | null,
): JobServerError {
  const detail = (message ?? "").toLowerCase();
  if (detail.includes("confirmation code is required")) {
    return new JobServerError(
      "CONFLICT",
      "Ingresá el código de 4 dígitos que el cliente ve en su Seguimiento.",
    );
  }
  if (detail.includes("confirmation code does not match")) {
    return new JobServerError(
      "CONFLICT",
      "Ese código no coincide. Pedile al cliente que lo revise en su Seguimiento e intentá de nuevo.",
    );
  }
  if (detail.includes("confirmation code locked")) {
    return new JobServerError(
      "CONFLICT",
      "Demasiados intentos con un código incorrecto. Esperá unos minutos antes de probar de nuevo.",
    );
  }
  if (detail.includes("job can no longer be disputed")) {
    return new JobServerError(
      "CONFLICT",
      "Este trabajo ya no admite disputa: el cierre quedó firme.",
    );
  }
  if (detail.includes("rejection reason is too short")) {
    return new JobServerError(
      "CONFLICT",
      "El motivo es demasiado corto: agregá un poco más de detalle.",
    );
  }
  if (detail.includes("submit the delivery before verifying")) {
    return new JobServerError(
      "CONFLICT",
      "Primero enviá la entrega para revisión; recién después se puede dejar constancia con el código.",
    );
  }
  if (detail.includes("remote delivery needs no code")) {
    return new JobServerError(
      "CONFLICT",
      "Esta entrega es remota y no usa código: revisá la entrega enviada.",
    );
  }
  if (detail.includes("delivery evidence is required")) {
    return new JobServerError(
      "CONFLICT",
      "Todavía no hay una entrega registrada para este trabajo.",
    );
  }
  if (detail.includes("handover verification is required")) {
    return new JobServerError(
      "CONFLICT",
      "Falta la constancia presencial del PIN antes de la confirmación final.",
    );
  }
  if (detail.includes("delivery summary is invalid")) {
    return new JobServerError(
      "CONFLICT",
      "El resumen de la entrega necesita entre 3 y 2000 caracteres.",
    );
  }
  if (detail.includes("correction reason is invalid")) {
    return new JobServerError(
      "CONFLICT",
      "El motivo de la corrección necesita entre 2 y 1000 caracteres.",
    );
  }
  if (detail.includes("too many corrections")) {
    return new JobServerError(
      "CONFLICT",
      "Ya se pidieron varias correcciones: reportá el problema para que medie el equipo de YALO.",
    );
  }
  return mapError(code);
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
    sort_key: typeof row.sort_key === "string" ? row.sort_key : null,
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

function isMissingJobListRpc(error: RpcError): boolean {
  if (error?.code === "42883" || error?.code === "PGRST202") return true;
  return (
    typeof error?.message === "string" &&
    /could not find the function/i.test(error.message)
  );
}

type JobListRpcName = "list_my_upcoming_jobs" | "list_my_past_jobs";

async function callJobListRpc(
  supabase: JobsRpcClient,
  name: JobListRpcName,
  cursor: JobCursor,
  pageSize: number,
  statusFilter: JobStatusFilter | null,
  legacy: boolean,
): Promise<UpcomingJob[]> {
  const bounded = Math.min(Math.max(pageSize, 1), 50);
  const args = legacy
    ? { limit_count: bounded }
    : name === "list_my_upcoming_jobs"
      ? {
          limit_count: bounded,
          status_filter: statusFilter,
          before_sort_key: cursor.beforeSortKey ?? null,
          before_id: cursor.beforeId ?? null,
        }
      : {
          limit_count: bounded,
          status_filter: statusFilter,
          before_updated_at: cursor.beforeUpdatedAt ?? null,
          before_id: cursor.beforeId ?? null,
        };
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (!legacy && isMissingJobListRpc(error)) {
      return callJobListRpc(supabase, name, {}, bounded, null, true);
    }
    throw mapError(error.code);
  }
  return filterValidJobRows(requireRows<UpcomingJob>(data));
}

// YALO B3: el filtro vive en SQL (status_filter) y la paginación recorre
// resultados con cursor keyset. Si el RPC nuevo aún no existe (deploy
// ordering), fallback a la forma legacy (primera página, límite 50).
export async function listMyUpcomingJobsPage(
  cursor: JobCursor = {},
  pageSize = 20,
  statusFilter: JobStatusFilter | null = null,
): Promise<UpcomingJob[]> {
  const { supabase } = await authenticatedClient();
  return callJobListRpc(
    supabase,
    "list_my_upcoming_jobs",
    cursor,
    pageSize,
    statusFilter,
    false,
  );
}

export async function listMyPastJobsPage(
  cursor: JobCursor = {},
  pageSize = 20,
  statusFilter: JobStatusFilter | null = null,
): Promise<UpcomingJob[]> {
  const { supabase } = await authenticatedClient();
  return callJobListRpc(
    supabase,
    "list_my_past_jobs",
    cursor,
    pageSize,
    statusFilter,
    false,
  );
}

// Acumulación completa (through) sobre el filtro server-side: recorrer
// páginas con cursor en vez de recortar la primera evita falsos vacíos.
export async function listMyUpcomingJobsThrough(
  through: PageKey | null,
  statusFilter: JobStatusFilter | null = null,
  pageSize = 20,
): Promise<PagedResult<UpcomingJob>> {
  return accumulateThrough(
    (cursor, limit) =>
      listMyUpcomingJobsPage(
        cursor ? { beforeSortKey: cursor.at, beforeId: cursor.id } : {},
        limit,
        statusFilter,
      ),
    (job) => ({ at: job.sort_key ?? job.updated_at, id: job.job_id }),
    (job) => job.job_id,
    through,
    pageSize,
  );
}

export async function listMyPastJobsThrough(
  through: PageKey | null,
  statusFilter: JobStatusFilter | null = null,
  pageSize = 20,
): Promise<PagedResult<UpcomingJob>> {
  return accumulateThrough(
    (cursor, limit) =>
      listMyPastJobsPage(
        cursor ? { beforeUpdatedAt: cursor.at, beforeId: cursor.id } : {},
        limit,
        statusFilter,
      ),
    (job) => ({ at: job.updated_at, id: job.job_id }),
    (job) => job.job_id,
    through,
    pageSize,
  );
}

export async function listMyUpcomingJobs(limit = 20): Promise<UpcomingJob[]> {
  return listMyUpcomingJobsPage({}, limit);
}

export async function listMyPastJobs(limit = 20): Promise<UpcomingJob[]> {
  return listMyPastJobsPage({}, limit);
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
    delivery_flow_available: Object.prototype.hasOwnProperty.call(row, "delivery_submitted_at"),
    confirmation_code:
      typeof row.confirmation_code === "string" &&
      row.confirmation_code.length > 0
        ? row.confirmation_code
        : null,
    // El reloj dedicado aterriza con la migración de lifecycle; hasta
    // entonces la UI lo trata como ausente.
    completion_requested_at:
      typeof row.completion_requested_at === "string" &&
      row.completion_requested_at.length > 0
        ? row.completion_requested_at
        : null,
    delivery_submitted_at:
      typeof row.delivery_submitted_at === "string" &&
      row.delivery_submitted_at.length > 0
        ? row.delivery_submitted_at
        : null,
    delivery_summary:
      typeof row.delivery_summary === "string" &&
      row.delivery_summary.length > 0
        ? row.delivery_summary
        : null,
    delivery_evidence_url:
      typeof row.delivery_evidence_url === "string" &&
      row.delivery_evidence_url.startsWith("https://")
        ? row.delivery_evidence_url
        : null,
    handover_verified_at:
      typeof row.handover_verified_at === "string" &&
      row.handover_verified_at.length > 0
        ? row.handover_verified_at
        : null,
    correction_count:
      typeof row.correction_count === "number" &&
      Number.isFinite(row.correction_count)
        ? row.correction_count
        : 0,
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
  return requireRows<JobScopeChange>(data).map((row) => ({
    ...row,
    response_reason:
      typeof row.response_reason === "string" && row.response_reason.length > 0
        ? row.response_reason
        : null,
  }));
}

export async function transitionJob(
  jobId: string,
  expectedStatus: JobStatus,
  requestedStatus: JobStatus,
  reason?: string | null,
  confirmationCode?: string | null,
): Promise<JobStatus> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("transition_job_status", {
    target_job_id: jobId,
    expected_status: expectedStatus,
    requested_status: requestedStatus,
    transition_reason: reason?.trim() || null,
    confirmation_code: confirmationCode?.trim() || null,
  });
  if (error) throw mapTransitionError(error.code, error.message);
  if (typeof data !== "string" || !jobStatuses.includes(data as JobStatus)) {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
  return data as JobStatus;
}

// YALO A1: único camino de cierre con código. El RPC devuelve resultado
// tipado en vez de excepcionar en MISMATCH/LOCKED para que el INSERT del
// intento haga commit. transition_job_status rechaza esta ruta (bypass).
export async function requestJobCompletion(
  jobId: string,
  code: string,
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("request_job_completion", {
    target_job_id: jobId,
    confirmation_code: code,
  });
  if (error) throw mapTransitionError(error.code, error.message);
  if (data === "COMPLETED") return;
  if (data === "MISMATCH") {
    throw new JobServerError(
      "CONFLICT",
      "Ese código no coincide. Pedile al cliente que lo revise en su Seguimiento e intentá de nuevo.",
    );
  }
  if (data === "LOCKED") {
    throw new JobServerError(
      "CONFLICT",
      "Demasiados intentos con un código incorrecto. Esperá unos minutos antes de probar de nuevo.",
    );
  }
  throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
}

/** Select the effective modality for an agreed BOTH job. Only client, before delivery. */
export async function chooseJobEffectiveModality(
  jobId: string,
  modality: "IN_PERSON" | "REMOTE",
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("choose_job_effective_modality", {
    target_job_id: jobId,
    requested_modality: modality,
  });
  if (error) throw mapTransitionError(error.code, error.message);
  if (data !== modality) throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
}

// YALO S3: enviar la entrega para revisión (sin código). En remoto mueve
// directo a COMPLETION_REQUESTED; en presencial queda IN_PROGRESS hasta la
// constancia por requestJobCompletion.
export async function submitJobDelivery(
  jobId: string,
  summary: string,
  evidenceUrl?: string | null,
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("submit_job_delivery", {
    target_job_id: jobId,
    delivery_summary: summary,
    delivery_evidence_url: evidenceUrl ?? null,
  });
  if (error) throw mapTransitionError(error.code, error.message);
  if (data !== "SUBMITTED") {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
}

// YALO S3: el cliente devuelve el trabajo a IN_PROGRESS con motivo.
export async function requestJobCorrection(
  jobId: string,
  reason: string,
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("request_job_correction", {
    target_job_id: jobId,
    correction_reason: reason,
  });
  if (error) throw mapTransitionError(error.code, error.message);
  if (data !== "CORRECTION_REQUESTED") {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
}

export type ExternalDeclarationState =
  | "DECLARED_BY_CLIENT"
  | "DECLARED_BY_PROVIDER"
  | "CONFIRMED_BY_BOTH"
  | "CONTESTED"
  | "VOIDED";

export type ExternalPaymentDeclaration = {
  id: string;
  job_id: string;
  declared_by_user_id: string;
  amount_minor: number;
  currency_code: string;
  method: "EFECTIVO" | "TRANSFERENCIA" | "OTRO_ACORDADO";
  paid_on: string | null;
  reference: string | null;
  state: ExternalDeclarationState;
  counterpart_reason: string | null;
  created_at: string;
};

const EXTERNAL_DECLARATION_STATES: ExternalDeclarationState[] = [
  "DECLARED_BY_CLIENT",
  "DECLARED_BY_PROVIDER",
  "CONFIRMED_BY_BOTH",
  "CONTESTED",
  "VOIDED",
];

function asDeclaration(row: Record<string, unknown>): ExternalPaymentDeclaration {
  const state = EXTERNAL_DECLARATION_STATES.includes(
    row.state as ExternalDeclarationState,
  )
    ? (row.state as ExternalDeclarationState)
    : ("DECLARED_BY_CLIENT" as const);
  return {
    id: String(row.id ?? ""),
    job_id: String(row.job_id ?? ""),
    declared_by_user_id: String(row.declared_by_user_id ?? ""),
    amount_minor:
      typeof row.amount_minor === "number" ? row.amount_minor : Number(row.amount_minor ?? 0),
    currency_code: typeof row.currency_code === "string" ? row.currency_code : "ARS",
    method:
      row.method === "EFECTIVO" ||
      row.method === "TRANSFERENCIA" ||
      row.method === "OTRO_ACORDADO"
        ? row.method
        : "OTRO_ACORDADO",
    paid_on: typeof row.paid_on === "string" ? row.paid_on : null,
    reference: typeof row.reference === "string" && row.reference.length > 0 ? row.reference : null,
    state,
    counterpart_reason:
      typeof row.counterpart_reason === "string" && row.counterpart_reason.length > 0
        ? row.counterpart_reason
        : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

// YALO S4: declarar dinero externo (solo en COMPLETED).
export async function declareExternalPayment(input: {
  jobId: string;
  amountMinor: number;
  method: "EFECTIVO" | "TRANSFERENCIA" | "OTRO_ACORDADO";
  paidOn?: string | null;
  reference?: string | null;
  idempotencyKey: string;
  supersedesId?: string | null;
}): Promise<string> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("declare_external_payment", {
    target_job_id: input.jobId,
    declared_amount_minor: input.amountMinor,
    declared_method: input.method,
    declared_paid_on: input.paidOn ?? null,
    declared_reference: input.reference ?? null,
    request_idempotency_key: input.idempotencyKey,
    supersedes_declaration_id: input.supersedesId ?? null,
  });
  if (error) throw mapMoneyError(error.code, error.message);
  if (typeof data !== "string" || data === "") {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
  return data;
}

// YALO S4: la contraparte confirma o contesta.
export async function respondExternalPayment(input: {
  declarationId: string;
  accepted: boolean;
  reason?: string | null;
}): Promise<string> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("respond_external_payment", {
    target_declaration_id: input.declarationId,
    accepted: input.accepted,
    counterpart_reason: input.reason ?? null,
  });
  if (error) throw mapMoneyError(error.code, error.message);
  if (typeof data !== "string" || data === "") {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
  return data;
}

// YALO S4: quien declaró anula su pendiente (corrección = void + nueva).
export async function voidExternalPayment(declarationId: string): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("void_external_payment", {
    target_declaration_id: declarationId,
  });
  if (error) throw mapMoneyError(error.code, error.message);
  if (data !== "VOIDED") {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
}

// YALO S4: ledger bilateral acordado/confirmado/reclamado/saldo.
export async function getExternalPaymentLedger(jobId: string): Promise<{
  agreedTotalMinor: number;
  confirmedMinor: number;
  claimedMinor: number;
  outstandingMinor: number;
}> {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.rpc("external_payment_ledger", {
    target_job_id: jobId,
  });
  if (error) {
    // Preserve PostgREST's schema-missing code so getExternalMoney can
    // degrade safely until the S4 migration is deployed. Never swallow
    // ordinary authorization/transient errors.
    if (isMissingExternalMoneySchema(error)) throw error;
    throw mapMoneyError(error.code, error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) {
    throw new JobServerError("TRANSIENT", "Respuesta inválida del servidor.");
  }
  return {
    agreedTotalMinor: Number(row.agreed_total_minor ?? 0),
    confirmedMinor: Number(row.external_confirmed_minor ?? 0),
    claimedMinor: Number(row.external_claimed_minor ?? 0),
    outstandingMinor: Number(row.external_outstanding_minor ?? 0),
  };
}

// YALO S4: ledger + historial juntos para la tarjeta de dinero.
export async function getExternalMoney(jobId: string): Promise<{
  ledger: { agreedTotalMinor: number; confirmedMinor: number; claimedMinor: number; outstandingMinor: number };
  declarations: ExternalPaymentDeclaration[];
} | null> {
  try {
    const [ledger, declarations] = await Promise.all([
      getExternalPaymentLedger(jobId),
      listExternalDeclarations(jobId),
    ]);
    return { ledger, declarations };
  } catch (error) {
    // Solo la migración pendiente cae al resumen de montos; cualquier otro
    // error (permiso, transitorio) se propaga a la página.
    if (isMissingExternalMoneySchema(error)) return null;
    throw error;
  }
}

// YALO S4: la tabla y los RPCs llegan con la migración; mismo criterio que
// isMissingJobListRpc más la tabla ausente en caché de PostgREST.
function isMissingExternalMoneySchema(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const shape = error as { code?: unknown; message?: unknown };
  if (shape.code === "42883" || shape.code === "PGRST202" || shape.code === "PGRST205") {
    return true;
  }
  return (
    typeof shape.message === "string" &&
    /could not find the (function|table)/i.test(shape.message)
  );
}

// YALO S4: historial completo de declaraciones (RLS: solo las partes).
export async function listExternalDeclarations(
  jobId: string,
): Promise<ExternalPaymentDeclaration[]> {
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
  const { data, error } = await supabase
    .from("external_payment_declarations")
    .select(
      "id, job_id, declared_by_user_id, amount_minor, currency_code, method, paid_on, reference, state, counterpart_reason, created_at",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    // Preserve PostgREST's schema-missing code so getExternalMoney can
    // degrade safely until the S4 migration is deployed. Never swallow
    // ordinary authorization/transient errors.
    if (isMissingExternalMoneySchema(error)) throw error;
    throw mapMoneyError(error.code, error.message);
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(asDeclaration);
}

function mapMoneyError(code?: string | null, message?: string | null): JobServerError {
  const detail = `${code ?? ""} ${message ?? ""}`;
  if (/authentication required/i.test(detail)) {
    return new JobServerError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para administrar trabajos.",
    );
  }
  if (code === "42501" || /job access denied|only the counterpart|only the declarer|only the declarer supersedes/i.test(detail)) {
    return new JobServerError(
      "FORBIDDEN",
      "No tenés permiso para esa acción sobre el dinero externo.",
    );
  }
  if (code === "P0002" || /declaration not found|superseded declaration not found/i.test(detail)) {
    return new JobServerError(
      "NOT_FOUND",
      "No encontramos esa declaración. Actualizá la página.",
    );
  }
  if (/only open declarations can be superseded/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "Solo se puede corregir una declaración abierta.",
    );
  }
  if (/only on completed jobs/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "El dinero externo se registra cuando el trabajo está completado.",
    );
  }
  if (/exceeds the agreed total/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "El monto supera el total acordado del trabajo.",
    );
  }
  if (/must be positive|amount/i.test(detail) && /positive/i.test(detail)) {
    return new JobServerError("CONFLICT", "El monto declarado debe ser positivo.");
  }
  if (/payment method is invalid/i.test(detail)) {
    return new JobServerError("CONFLICT", "El método de pago informado no es válido.");
  }
  if (/payment date is invalid/i.test(detail)) {
    return new JobServerError("CONFLICT", "La fecha aproximada del pago no es válida.");
  }
  if (/payment reference is invalid/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "La referencia admite hasta 140 caracteres, sin datos bancarios.",
    );
  }
  if (/reason is required to contest/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "Para marcar desacuerdo contanos el motivo.",
    );
  }
  if (/too many pending declarations/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "Hay demasiadas declaraciones pendientes: resolvé las abiertas antes de informar otra.",
    );
  }
  if (/already resolved/i.test(detail)) {
    return new JobServerError(
      "CONFLICT",
      "Esa declaración ya fue resuelta. Actualizá la página.",
    );
  }
  return new JobServerError(
    "TRANSIENT",
    "No pudimos registrar el movimiento. Intentá nuevamente.",
  );
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
  reason?: string | null,
): Promise<void> {
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("respond_job_scope_change", {
    target_scope_change_id: scopeChangeId,
    response_action: action,
    response_reason: reason?.trim() || null,
  });
  if (error) throw mapTransitionError(error.code, error.message);
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
