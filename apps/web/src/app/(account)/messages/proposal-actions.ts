"use server";

import { revalidatePath } from "next/cache";

import {
  parseMajorAmountToMinor,
  proposalKinds,
  type ProposalKind,
} from "@changas/domain";

import {
  createConversationProposal,
  ProposalServerError,
  respondToProposal,
  reviseConversationProposal,
  simulateFakeProposalPayment,
  type FakePaymentOutcome,
  type ProposalResponseAction,
} from "@/lib/proposals/server";

export type ProposalActionState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function requiredUuid(formData: FormData, name: string): string {
  const value = stringField(formData, name);
  if (!UUID_PATTERN.test(value)) throw new Error("Identificador inválido.");
  return value;
}

function optionalIso(formData: FormData, name: string): string | null {
  const value = stringField(formData, name);
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Fecha inválida.");
  return new Date(timestamp).toISOString();
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

export async function createProposalAction(
  _previousState: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  try {
    const conversationId = requiredUuid(formData, "conversationId");
    await createConversationProposal({
      conversationId,
      kind: proposalKind(formData),
      scopeText: stringField(formData, "scope") || null,
      priceAmount: optionalPrice(formData),
      scheduleStartAt: optionalIso(formData, "scheduleStartAt"),
      scheduleEndAt: optionalIso(formData, "scheduleEndAt"),
      deadlineAt: optionalIso(formData, "deadlineAt"),
      expiresAt: optionalIso(formData, "expiresAt"),
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

export async function respondProposalAction(formData: FormData): Promise<void> {
  const conversationId = requiredUuid(formData, "conversationId");
  const proposalId = requiredUuid(formData, "proposalId");
  const action = stringField(formData, "action") as ProposalResponseAction;
  if (!["ACCEPT", "REJECT", "WITHDRAW"].includes(action)) {
    throw new Error("Acción de propuesta inválida.");
  }
  await respondToProposal(proposalId, action);
  revalidatePath(`/messages/${conversationId}`);
}

export async function fakePaymentAction(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("La simulación de pagos no está disponible en producción.");
  }

  const conversationId = requiredUuid(formData, "conversationId");
  const proposalId = requiredUuid(formData, "proposalId");
  const submittedNonce = stringField(formData, "paymentNonce");
  const nonce = submittedNonce || crypto.randomUUID();
  if (!UUID_PATTERN.test(nonce)) {
    throw new Error("Identificador de pago inválido.");
  }
  const outcome = stringField(formData, "outcome") as FakePaymentOutcome;
  if (!["SUCCESS", "PENDING", "FAILURE"].includes(outcome)) {
    throw new Error("Resultado de pago inválido.");
  }
  await simulateFakeProposalPayment(conversationId, proposalId, nonce, outcome);
  revalidatePath(`/messages/${conversationId}`);
}
