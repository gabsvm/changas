"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  jobStatuses,
  parseOptionalAdditionalAmount,
  scheduleTypes,
  type JobStatus,
  type ScheduleType,
} from "@changas/domain";
import { isUuid } from "@changas/validation";

import {
  applyFakeAdditionalPayment,
  applyFakeSettlementPayment,
  declareExternalPayment,
  JobServerError,
  requestJobCorrection,
  requestJobReschedule,
  requestJobScopeChange,
  respondJobReschedule,
  respondJobScopeChange,
  requestJobCompletion,
  respondExternalPayment,
  setJobExactLocation,
  submitJobDelivery,
  transitionJob,
  voidExternalPayment,
} from "@/lib/jobs/server";
import {
  createJobReview,
  createRehireProposal,
  reportReview,
  upsertProviderReviewReply,
  type ReviewReportReason,
} from "@/lib/reputation/server";
import { createClient } from "@/lib/supabase/server";
import { isPaymentsEnabled } from "@changas/config/server";
import {
  createJobSettlementCheckout,
  createScopeChangeCheckout,
} from "@/lib/payments/server";

const reviewReportReasons: ReviewReportReason[] = [
  "THREATS",
  "INSULTS",
  "PRIVATE_INFORMATION",
  "DISCRIMINATION",
  "IRRELEVANT_CONTENT",
  "EXTORTION",
  "ABUSE",
  "OTHER",
];

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function uuidField(formData: FormData, name: string): string {
  const value = stringField(formData, name);
  if (!isUuid(value)) throw new Error("Identificador inválido.");
  return value;
}

function optionalIso(formData: FormData, name: string): string | null {
  const value = stringField(formData, name);
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Fecha inválida.");
  return new Date(parsed).toISOString();
}

function optionalNumber(formData: FormData, name: string): number | null {
  const value = stringField(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("Número inválido.");
  return parsed;
}

function ratingField(
  formData: FormData,
  name: string,
  required = false,
): number | null {
  const value = stringField(formData, name);
  if (!value && !required) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("La calificación debe estar entre 1 y 5.");
  }
  return parsed;
}

export async function transitionJobAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const expected = stringField(formData, "expectedStatus") as JobStatus;
  const requested = stringField(formData, "requestedStatus") as JobStatus;
  if (!jobStatuses.includes(expected) || !jobStatuses.includes(requested)) {
    throw new Error("Estado inválido.");
  }
  await transitionJob(
    jobId,
    expected,
    requested,
    stringField(formData, "reason"),
    stringField(formData, "confirmationCode") || null,
  );
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export type CompletionCodeState = { error: string | null };

// Constancia de entrega presencial con el código del cliente (YALO S3: ya
// no es el pedido de revisión, sino la verificación tras el envío).
// Devuelve el error como estado para mostrarlo junto al input.
export async function requestCompletionAction(
  _previousState: CompletionCodeState,
  formData: FormData,
): Promise<CompletionCodeState> {
  const jobId = uuidField(formData, "jobId");
  const code = stringField(formData, "confirmationCode");
  if (!/^[0-9]{4}$/.test(code)) {
    return {
      error: "Ingresá los 4 dígitos que el cliente comparte tras revisar.",
    };
  }
  try {
    // YALO A1: autoridad única con rate-limit persistente. transitionJob
    // rechaza esta ruta para que no exista bypass por RPC directo.
    await requestJobCompletion(jobId, code);
  } catch (error) {
    if (error instanceof JobServerError) return { error: error.message };
    return { error: "No pudimos completar la acción. Intentá nuevamente." };
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { error: null };
}

export type DeliverySubmitState = { error: string | null };

// Envío de la entrega para revisión (sin código). Solo la usa el
// formulario de entrega del prestador.
export async function submitDeliveryAction(
  _previousState: DeliverySubmitState,
  formData: FormData,
): Promise<DeliverySubmitState> {
  const jobId = uuidField(formData, "jobId");
  const summary = stringField(formData, "deliverySummary");
  if (summary.length < 3 || summary.length > 2000) {
    return {
      error: "El resumen de la entrega necesita entre 3 y 2000 caracteres.",
    };
  }
  try {
    await submitJobDelivery(jobId, summary);
  } catch (error) {
    if (error instanceof JobServerError) return { error: error.message };
    return { error: "No pudimos completar la acción. Intentá nuevamente." };
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { error: null };
}

// Pedido de corrección del cliente con motivo. Vuelve el trabajo a curso.
export async function requestCorrectionAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const reason = stringField(formData, "correctionReason");
  if (reason.length < 2 || reason.length > 1000) {
    throw new Error("El motivo de la corrección necesita entre 2 y 1000 caracteres.");
  }
  try {
    await requestJobCorrection(jobId, reason);
  } catch (error) {
    if (error instanceof JobServerError) throw new Error(error.message);
    throw error;
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

const EXTERNAL_MONEY_METHODS = ["EFECTIVO", "TRANSFERENCIA", "OTRO_ACORDADO"] as const;

function moneyMinorField(formData: FormData): number {
  const raw = stringField(formData, "amount").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error("El monto declarado debe ser positivo.");
  const minor = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new Error("El monto declarado debe ser positivo.");
  }
  return minor;
}

// Declarar dinero externo (quien paga o quien recibe). Solo COMPLETED.
export async function declareExternalPaymentAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const method = stringField(formData, "method");
  if (!EXTERNAL_MONEY_METHODS.includes(method as (typeof EXTERNAL_MONEY_METHODS)[number])) {
    throw new Error("El método de pago informado no es válido.");
  }
  const paidOnRaw = stringField(formData, "paidOn");
  const reference = stringField(formData, "reference");
  if (reference.length > 140) {
    throw new Error("La referencia admite hasta 140 caracteres, sin datos bancarios.");
  }
  // Clave del formulario (estable por render); si falta o es inválida se
  // genera una fresca para no romper envíos antiguos.
  const rawKey = stringField(formData, "idempotencyKey");
  const idempotencyKey = isUuid(rawKey) ? rawKey : randomUUID();
  try {
    await declareExternalPayment({
      jobId,
      amountMinor: moneyMinorField(formData),
      method: method as (typeof EXTERNAL_MONEY_METHODS)[number],
      paidOn: paidOnRaw === "" ? null : paidOnRaw,
      reference: reference === "" ? null : reference,
      idempotencyKey,
      supersedesId: stringField(formData, "supersedesId") === "" ? null : uuidField(formData, "supersedesId"),
    });
  } catch (error) {
    if (error instanceof JobServerError) throw new Error(error.message);
    throw error;
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

// La contraparte confirma o contesta con motivo.
export async function respondExternalPaymentAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const declarationId = uuidField(formData, "declarationId");
  const accepted = stringField(formData, "decision") === "accept";
  const reason = stringField(formData, "reason");
  if (!accepted && (reason.length < 1 || reason.length > 1000)) {
    throw new Error("Para marcar desacuerdo contanos el motivo.");
  }
  try {
    await respondExternalPayment({
      declarationId,
      accepted,
      reason: accepted ? null : reason,
    });
  } catch (error) {
    if (error instanceof JobServerError) throw new Error(error.message);
    throw error;
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

// Quien declaró anula su pendiente (corrección = void + nueva).
export async function voidExternalPaymentAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const declarationId = uuidField(formData, "declarationId");
  try {
    await voidExternalPayment(declarationId);
  } catch (error) {
    if (error instanceof JobServerError) throw new Error(error.message);
    throw error;
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function requestRescheduleAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const scheduleType = stringField(formData, "scheduleType") as ScheduleType;
  if (!scheduleTypes.includes(scheduleType))
    throw new Error("Agenda inválida.");

  await requestJobReschedule({
    jobId,
    scheduleType,
    startsAt: optionalIso(formData, "startsAt"),
    endsAt: optionalIso(formData, "endsAt"),
    deadlineAt: optionalIso(formData, "deadlineAt"),
    durationMinutes: optionalNumber(formData, "durationMinutes"),
    reason: stringField(formData, "reason") || null,
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function respondRescheduleAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const requestId = uuidField(formData, "requestId");
  const action = stringField(formData, "action");
  if (action !== "ACCEPT" && action !== "REJECT")
    throw new Error("Acción inválida.");
  await respondJobReschedule(requestId, action);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function requestScopeChangeAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const scope = stringField(formData, "scope");
  if (scope.length < 3) throw new Error("Describí el nuevo alcance.");
  const amountMinor = parseOptionalAdditionalAmount(
    stringField(formData, "additionalPrice"),
    "ARS",
  );
  await requestJobScopeChange(jobId, scope, amountMinor);
  revalidatePath(`/jobs/${jobId}`);
}

export async function respondScopeChangeAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const scopeChangeId = uuidField(formData, "scopeChangeId");
  const action = stringField(formData, "action");
  if (action !== "ACCEPT" && action !== "REJECT")
    throw new Error("Acción inválida.");
  await respondJobScopeChange(
    scopeChangeId,
    action,
    stringField(formData, "responseReason") || null,
  );
  revalidatePath(`/jobs/${jobId}`);
}

export async function fakeAdditionalPaymentAction(
  formData: FormData,
): Promise<void> {
  // Production gating (with the admin exception) is enforced in
  // applyFakeAdditionalPayment, the single choke point.
  const jobId = uuidField(formData, "jobId");
  const scopeChangeId = uuidField(formData, "scopeChangeId");
  const nonce = stringField(formData, "paymentNonce") || crypto.randomUUID();
  if (!isUuid(nonce)) throw new Error("Pago inválido.");
  const outcome = stringField(formData, "outcome");
  if (outcome !== "SUCCESS" && outcome !== "PENDING" && outcome !== "FAILURE") {
    throw new Error("Resultado inválido.");
  }
  await applyFakeAdditionalPayment({
    jobId,
    scopeChangeId,
    nonce,
    outcome,
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function startScopeChangeCheckoutAction(
  formData: FormData,
): Promise<void> {
  if (!isPaymentsEnabled()) {
    throw new Error("El pago online todavía no está habilitado.");
  }
  const scopeChangeId = uuidField(formData, "scopeChangeId");
  const checkout = await createScopeChangeCheckout(
    scopeChangeId,
    crypto.randomUUID(),
  );
  redirect(checkout.checkoutUrl);
}

export async function startJobSettlementCheckoutAction(
  formData: FormData,
): Promise<void> {
  if (!isPaymentsEnabled()) {
    throw new Error("El pago online todavía no está habilitado.");
  }
  const jobId = uuidField(formData, "jobId");
  // La clave idempotente deriva del trabajo + versión económica en el
  // servidor: reintentar el formulario reusa la sesión vigente.
  const checkout = await createJobSettlementCheckout(jobId);
  redirect(checkout.checkoutUrl);
}

export async function fakeSettlementPaymentAction(
  formData: FormData,
): Promise<void> {
  // Production gating (with the admin exception) is enforced in
  // applyFakeSettlementPayment, the single choke point.
  const jobId = uuidField(formData, "jobId");
  const nonce = stringField(formData, "paymentNonce") || crypto.randomUUID();
  if (!isUuid(nonce)) throw new Error("Pago inválido.");
  const outcome = stringField(formData, "outcome");
  if (outcome !== "SUCCESS" && outcome !== "PENDING" && outcome !== "FAILURE") {
    throw new Error("Resultado inválido.");
  }
  await applyFakeSettlementPayment({ jobId, nonce, outcome });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function setJobLocationAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const address = stringField(formData, "address");
  if (address.length < 5) throw new Error("Ingresá una dirección válida.");
  await setJobExactLocation({
    jobId,
    address,
    notes: stringField(formData, "notes") || null,
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function createJobReviewAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const supabase = await createClient();
  await createJobReview(supabase, {
    jobId,
    rating: ratingField(formData, "rating", true)!,
    reviewText: stringField(formData, "reviewText") || null,
    qualityRating: ratingField(formData, "qualityRating"),
    punctualityRating: ratingField(formData, "punctualityRating"),
    communicationRating: ratingField(formData, "communicationRating"),
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function replyToJobReviewAction(
  formData: FormData,
): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const reviewId = uuidField(formData, "reviewId");
  const replyText = stringField(formData, "replyText");
  if (replyText.length < 2) throw new Error("Escribí una respuesta válida.");
  const supabase = await createClient();
  await upsertProviderReviewReply(supabase, reviewId, replyText);
  revalidatePath(`/jobs/${jobId}`);
}

export async function reportJobReviewAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const reviewId = uuidField(formData, "reviewId");
  const reason = stringField(formData, "reason") as ReviewReportReason;
  if (!reviewReportReasons.includes(reason)) {
    throw new Error("Motivo de reporte inválido.");
  }
  const supabase = await createClient();
  await reportReview(
    supabase,
    reviewId,
    reason,
    stringField(formData, "details") || null,
  );
  revalidatePath(`/jobs/${jobId}`);
}

export async function rehireJobAction(formData: FormData): Promise<never> {
  const jobId = uuidField(formData, "jobId");
  const supabase = await createClient();
  const result = await createRehireProposal(supabase, jobId);
  revalidatePath("/jobs");
  revalidatePath("/messages");
  redirect(`/messages/${result.conversation_id}`);
}
