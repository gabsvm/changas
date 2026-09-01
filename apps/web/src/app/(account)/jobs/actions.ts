"use server";

import { revalidatePath } from "next/cache";

import {
  jobStatuses,
  parseMajorAmountToMinor,
  scheduleTypes,
  type JobStatus,
  type ScheduleType,
} from "@changas/domain";

import {
  applyFakeAdditionalPayment,
  requestJobReschedule,
  requestJobScopeChange,
  respondJobReschedule,
  respondJobScopeChange,
  setJobExactLocation,
  transitionJob,
} from "@/lib/jobs/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function uuidField(formData: FormData, name: string): string {
  const value = stringField(formData, name);
  if (!UUID_PATTERN.test(value)) throw new Error("Identificador inválido.");
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

export async function transitionJobAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const expected = stringField(formData, "expectedStatus") as JobStatus;
  const requested = stringField(formData, "requestedStatus") as JobStatus;
  if (!jobStatuses.includes(expected) || !jobStatuses.includes(requested)) {
    throw new Error("Estado inválido.");
  }
  await transitionJob(jobId, expected, requested, stringField(formData, "reason"));
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function requestRescheduleAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const scheduleType = stringField(formData, "scheduleType") as ScheduleType;
  if (!scheduleTypes.includes(scheduleType)) throw new Error("Agenda inválida.");

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

export async function respondRescheduleAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const requestId = uuidField(formData, "requestId");
  const action = stringField(formData, "action");
  if (action !== "ACCEPT" && action !== "REJECT") throw new Error("Acción inválida.");
  await respondJobReschedule(requestId, action);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function requestScopeChangeAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const scope = stringField(formData, "scope");
  if (scope.length < 3) throw new Error("Describí el nuevo alcance.");
  const price = stringField(formData, "additionalPrice");
  const amountMinor = price ? parseMajorAmountToMinor(price, "ARS") : 0;
  await requestJobScopeChange(jobId, scope, amountMinor);
  revalidatePath(`/jobs/${jobId}`);
}

export async function respondScopeChangeAction(formData: FormData): Promise<void> {
  const jobId = uuidField(formData, "jobId");
  const scopeChangeId = uuidField(formData, "scopeChangeId");
  const action = stringField(formData, "action");
  if (action !== "ACCEPT" && action !== "REJECT") throw new Error("Acción inválida.");
  await respondJobScopeChange(scopeChangeId, action);
  revalidatePath(`/jobs/${jobId}`);
}

export async function fakeAdditionalPaymentAction(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("No disponible en producción.");
  const jobId = uuidField(formData, "jobId");
  const scopeChangeId = uuidField(formData, "scopeChangeId");
  const nonce = stringField(formData, "paymentNonce") || crypto.randomUUID();
  if (!UUID_PATTERN.test(nonce)) throw new Error("Pago inválido.");
  const outcome = stringField(formData, "outcome");
  if (outcome !== "SUCCESS" && outcome !== "PENDING" && outcome !== "FAILURE") {
    throw new Error("Resultado inválido.");
  }
  await applyFakeAdditionalPayment({ scopeChangeId, nonce, outcome });
  revalidatePath(`/jobs/${jobId}`);
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
