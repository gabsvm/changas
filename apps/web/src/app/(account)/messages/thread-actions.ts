"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@changas/validation";

import {
  listConversationMessages,
  type ConversationMessage,
} from "@/lib/conversations/messages";
import {
  blockConversationUser,
  markConversationRead,
  reportConversation,
  unblockConversationUser,
} from "@/lib/conversations/server";

function assertUuid(value: string): void {
  if (!isUuid(value)) throw new Error("Identificador inválido.");
}

export async function loadOlderMessages(
  conversationId: string,
  beforeCreatedAt: string,
  beforeId: string,
): Promise<ConversationMessage[]> {
  assertUuid(conversationId);
  assertUuid(beforeId);
  if (!Number.isFinite(Date.parse(beforeCreatedAt))) {
    throw new Error("Cursor inválido.");
  }

  return listConversationMessages(conversationId, {
    beforeCreatedAt,
    beforeId,
  });
}

export async function markConversationReadAction(
  conversationId: string,
  messageId: string,
): Promise<void> {
  assertUuid(conversationId);
  assertUuid(messageId);
  await markConversationRead(conversationId, messageId);
}

export async function setConversationBlocked(
  conversationId: string,
  peerUserId: string,
  shouldBlock: boolean,
): Promise<void> {
  assertUuid(conversationId);
  assertUuid(peerUserId);

  if (shouldBlock) {
    await blockConversationUser(conversationId, peerUserId);
  } else {
    await unblockConversationUser(conversationId, peerUserId);
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
}

export type ReportConversationState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
};

export async function submitConversationReport(
  _previous: ReportConversationState,
  formData: FormData,
): Promise<ReportConversationState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!isUuid(conversationId)) {
    return { status: "ERROR", message: "Conversación inválida." };
  }
  if (category.length < 2 || category.length > 80) {
    return { status: "ERROR", message: "Elegí un motivo válido." };
  }
  if (reason.length > 2000) {
    return { status: "ERROR", message: "El detalle es demasiado largo." };
  }

  try {
    await reportConversation(conversationId, category, reason || null);
    return {
      status: "SUCCESS",
      message: "Reporte recibido. El historial se conserva para revisión.",
    };
  } catch {
    return {
      status: "ERROR",
      message: "No pudimos enviar el reporte. Intentá nuevamente.",
    };
  }
}
