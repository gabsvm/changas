"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  parseMajorAmountToMinor,
  proposalKinds,
  type ProposalKind,
} from "@changas/domain";
import { isUuid } from "@changas/validation";

import {
  createConversationProposal,
  ProposalServerError,
  respondToProposal,
  reviseConversationProposal,
  simulateFakeProposalPayment,
  type FakePaymentOutcome,
  type ProposalResponseAction,
} from "@/lib/proposals/server";
import { listConversationJobs } from "@/lib/jobs/server";
import { createProposalCheckout } from "@/lib/payments/server";
import { createClient } from "@/lib/supabase/server";
import { getConversationContext } from "@/lib/conversations/server";
import { parseProductDateTime } from "@/lib/product-time";

export type ProposalActionState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  /** Solo en ACCEPT exitoso: job recién creado para enlazar sin redirigir. */
  jobId?: string | null;
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function requiredUuid(formData: FormData, name: string): string {
  const value = stringField(formData, name);
  if (!isUuid(value)) throw new Error("Identificador inválido.");
  return value;
}

function optionalIso(formData: FormData, name: string): string | null {
  const value = stringField(formData, name);
  if (!value) return null;
  const timestamp = parseProductDateTime(value);
  if (!timestamp) throw new Error("Fecha inválida.");
  return timestamp.toISOString();
}

function optionalPrice(formData: FormData): number | null {
  const value = stringField(formData, "price");
  if (!value) return null;
  return parseMajorAmountToMinor(value, "ARS");
}

function proposalKind(formData: FormData): ProposalKind {
  const value = stringField(formData, "kind") as ProposalKind;
  if (!proposalKinds.includes(value))
    throw new Error("Tipo de propuesta inválido.");
  return value;
}

function actionError(error: unknown): ProposalActionState {
  if (error instanceof ProposalServerError) {
    return { status: "ERROR", message: error.message };
  }
  if (error instanceof Error) {
    return { status: "ERROR", message: error.message };
  }
  return {
    status: "ERROR",
    message: "No pudimos completar la acción. Intentá nuevamente.",
  };
}

/** Defense in depth while the legacy S1 RPC is still installed in prod.
 * The S1 migration additionally enforces this under a DB lock.
 */
async function requireInstantPreauthorization(
  conversationId: string,
): Promise<void> {
  const supabase = await createClient();
  const thread = await getConversationContext(conversationId);
  if (!thread) throw new Error("No podemos consultar este servicio.");
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("instant_booking_enabled")
    .eq("id", thread.service_id)
    .maybeSingle();
  if (serviceError || service?.instant_booking_enabled !== true) {
    throw new Error(
      "Este servicio requiere aceptación del prestador. Usá «Solicitar cotización».",
    );
  }
}

export async function createProposalAction(
  _previousState: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  try {
    const conversationId = requiredUuid(formData, "conversationId");
    const rawKey = stringField(formData, "idempotencyKey");
    const kind = proposalKind(formData);
    if (kind === "DIRECT_BOOKING")
      await requireInstantPreauthorization(conversationId);
    await createConversationProposal({
      conversationId,
      kind,
      scopeText: stringField(formData, "scope") || null,
      priceAmount: optionalPrice(formData),
      scheduleStartAt: optionalIso(formData, "scheduleStartAt"),
      scheduleEndAt: optionalIso(formData, "scheduleEndAt"),
      deadlineAt: optionalIso(formData, "deadlineAt"),
      expiresAt: optionalIso(formData, "expiresAt"),
      idempotencyKey: isUuid(rawKey) ? rawKey : null,
    });
    revalidatePath(`/messages/${conversationId}`);
    return { status: "SUCCESS", message: "Propuesta creada." };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviseProposalAction(
  _previousState: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  try {
    const conversationId = requiredUuid(formData, "conversationId");
    await reviseConversationProposal({
      proposalId: requiredUuid(formData, "proposalId"),
      kind: proposalKind(formData),
      scopeText: stringField(formData, "scope") || null,
      priceAmount: optionalPrice(formData),
      scheduleStartAt: optionalIso(formData, "scheduleStartAt"),
      scheduleEndAt: optionalIso(formData, "scheduleEndAt"),
      deadlineAt: optionalIso(formData, "deadlineAt"),
      expiresAt: optionalIso(formData, "expiresAt"),
    });
    revalidatePath(`/messages/${conversationId}`);
    return { status: "SUCCESS", message: "Propuesta actualizada." };
  } catch (error) {
    return actionError(error);
  }
}

const respondExpectedStatus: Record<ProposalResponseAction, string> = {
  ACCEPT: "ACCEPTED",
  REJECT: "REJECTED",
  WITHDRAW: "WITHDRAWN",
};

const respondSuccessMessages: Record<ProposalResponseAction, string> = {
  ACCEPT: "¡Contratado! El trabajo quedó confirmado sin pago por adelantado.",
  REJECT: "Propuesta rechazada.",
  WITHDRAW: "Propuesta retirada.",
};

function isNetworkLike(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("red") ||
    message.includes("timeout") ||
    message.includes("tempor") ||
    message.includes("econn") ||
    message.includes("socket")
  );
}

function respondActionError(
  error: unknown,
  action: ProposalResponseAction | null,
): ProposalActionState {
  if (isNetworkLike(error)) {
    return {
      status: "ERROR",
      message:
        "Hubo un problema de red o temporal. Revisá tu conexión e intentá nuevamente.",
    };
  }
  if (error instanceof ProposalServerError) {
    const raw = error.message.toLowerCase();
    if (
      error.code === "FORBIDDEN" &&
      (raw.includes("block") || raw.includes("bloque"))
    ) {
      return {
        status: "ERROR",
        message: "No podés responder porque esta conversación está bloqueada.",
      };
    }
    if (raw.includes("venci") || raw.includes("expir")) {
      return {
        status: "ERROR",
        message:
          "La propuesta venció y ya no se puede responder. Pedí una nueva cotización en esta misma conversación.",
      };
    }
    if (error.code === "CONFLICT") {
      return {
        status: "ERROR",
        message:
          action === "ACCEPT"
            ? "El trabajo o la propuesta cambió de estado mientras respondías. Revisá el estado actual antes de reintentar."
            : "La propuesta ya cambió de estado. Actualizamos la vista: revisá el estado actual antes de reintentar.",
      };
    }
    if (error.code === "TRANSIENT") {
      return {
        status: "ERROR",
        message:
          "Hubo un problema temporal y no pudimos registrar tu respuesta. Intentá nuevamente.",
      };
    }
    return { status: "ERROR", message: error.message };
  }
  if (error instanceof Error) {
    return { status: "ERROR", message: error.message };
  }
  return {
    status: "ERROR",
    message: "No pudimos completar la acción. Intentá nuevamente.",
  };
}

export async function respondProposalAction(
  _previousState: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  let action: ProposalResponseAction | null = null;
  try {
    const conversationId = requiredUuid(formData, "conversationId");
    const proposalId = requiredUuid(formData, "proposalId");
    const submitted = stringField(formData, "action") as ProposalResponseAction;
    if (!["ACCEPT", "REJECT", "WITHDRAW"].includes(submitted)) {
      return { status: "ERROR", message: "Acción de propuesta inválida." };
    }
    action = submitted;
    const resultingStatus = await respondToProposal(
      proposalId,
      action,
      stringField(formData, "responseReason") || null,
    );
    revalidatePath(`/messages/${conversationId}`);
    if (resultingStatus === "EXPIRED") {
      return {
        status: "ERROR",
        message:
          "La propuesta venció y ya no se puede responder. Pedí una nueva cotización en esta misma conversación.",
      };
    }
    if (resultingStatus !== respondExpectedStatus[action]) {
      return {
        status: "ERROR",
        message:
          action === "ACCEPT"
            ? "El trabajo o la propuesta cambió de estado mientras respondías. Revisá el estado actual antes de reintentar."
            : "La propuesta ya cambió de estado. Actualizamos la vista: revisá el estado actual antes de reintentar.",
      };
    }
    if (action === "ACCEPT") {
      // El RPC ordena por creación descendente: el primero es el trabajo
      // recién creado. Solo para enlazar "Ver seguimiento" (sin redirect);
      // si la lectura falla, la contratación igual queda confirmada.
      let jobId: string | null = null;
      try {
        jobId = (await listConversationJobs(conversationId))[0]?.job_id ?? null;
      } catch {
        jobId = null;
      }
      return {
        status: "SUCCESS",
        message: respondSuccessMessages[action],
        jobId,
      };
    }
    return { status: "SUCCESS", message: respondSuccessMessages[action] };
  } catch (error) {
    return respondActionError(error, action);
  }
}

export async function fakePaymentAction(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("La simulación de pagos no está disponible en producción.");
  }

  const conversationId = requiredUuid(formData, "conversationId");
  const proposalId = requiredUuid(formData, "proposalId");
  const submittedNonce = stringField(formData, "paymentNonce");
  const nonce = submittedNonce || crypto.randomUUID();
  if (!isUuid(nonce)) {
    throw new Error("Identificador de pago inválido.");
  }
  const outcome = stringField(formData, "outcome") as FakePaymentOutcome;
  if (!["SUCCESS", "PENDING", "FAILURE"].includes(outcome)) {
    throw new Error("Resultado de pago inválido.");
  }
  await simulateFakeProposalPayment(conversationId, proposalId, nonce, outcome);
  revalidatePath(`/messages/${conversationId}`);
}

export async function startProposalCheckoutAction(
  formData: FormData,
): Promise<void> {
  const proposalId = requiredUuid(formData, "proposalId");
  const checkout = await createProposalCheckout(
    proposalId,
    crypto.randomUUID(),
  );
  redirect(checkout.checkoutUrl);
}
