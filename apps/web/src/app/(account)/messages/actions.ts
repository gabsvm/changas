"use server";

import {
  assessOutgoingMessage,
  type LeakageSignalType,
} from "@changas/domain";
import { messageTextSchema } from "@changas/validation";

import { sendConversationText } from "@/lib/conversations/messages";
import {
  ConversationServerError,
  recordConversationModerationWarning,
} from "@/lib/conversations/server";

export type SendTextMessageState = {
  status: "IDLE" | "SUCCESS" | "WARNING" | "ERROR";
  message: string;
  messageId?: string;
  signalTypes?: LeakageSignalType[];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sendTextMessage(
  _previousState: SendTextMessageState,
  formData: FormData,
): Promise<SendTextMessageState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const nonce = String(formData.get("nonce") ?? "");
  const bodyResult = messageTextSchema.safeParse(formData.get("body"));
  const explicitlyConfirmed = formData.get("confirmLeakage") === "true";

  if (!uuidPattern.test(conversationId) || !uuidPattern.test(nonce)) {
    return {
      status: "ERROR",
      message: "No pudimos identificar la conversación o el mensaje.",
    };
  }

  if (!bodyResult.success) {
    return {
      status: "ERROR",
      message: "El mensaje debe tener entre 1 y 4000 caracteres.",
    };
  }

  const assessment = assessOutgoingMessage(
    bodyResult.data,
    explicitlyConfirmed,
  );

  try {
    if (assessment.signalTypes.length > 0) {
      await recordConversationModerationWarning(
        conversationId,
        assessment.signalTypes,
      );
    }

    if (assessment.action === "WARN") {
      return {
        status: "WARNING",
        message:
          "Este mensaje parece incluir datos de contacto o pago. Si seguís, la operación puede quedar fuera de la protección de Changas.",
        signalTypes: assessment.signalTypes,
      };
    }

    const messageId = await sendConversationText(
      conversationId,
      bodyResult.data,
      nonce,
    );
    return {
      status: "SUCCESS",
      message: "Mensaje enviado.",
      messageId,
    };
  } catch (error) {
    if (error instanceof ConversationServerError) {
      return { status: "ERROR", message: error.message };
    }

    return {
      status: "ERROR",
      message: "No pudimos enviar el mensaje. Intentá nuevamente.",
    };
  }
}
