"use server";

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
  JobServerError,
  requestJobReschedule,
  requestJobScopeChange,
  respondJobReschedule,
  respondJobScopeChange,
  requestJobCompletion,
  setJobExactLocation,
  transitionJob,
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

// Pedido de finalización con el código del cliente: devuelve el error
// como estado para mostrarlo junto al input en vez de una excepción
// genérica. Solo la usa el formulario del código.
export async function requestCompletionAction(
  _previousState: CompletionCodeState,
  formData: FormData,
): Promise<CompletionCodeState> {
  const jobId = uuidField(formData, "jobId");
  const code = stringField(formData, "confirmationCode");
  if (!/^[0-9]{4}$/.test(code)) {
    return {
      error: "Ingresá los 4 dígitos que el cliente ve en su Seguimiento.",
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
