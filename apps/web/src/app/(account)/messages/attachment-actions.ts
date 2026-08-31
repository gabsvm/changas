"use server";

import {
  conversationAttachmentSchema,
  maxConversationAttachmentsPerMessage,
} from "@changas/validation";

import {
  createConversationAttachmentMessage,
  uploadConversationAttachment,
  type ConversationAttachmentKind,
} from "@/lib/conversations/attachments";
import { ConversationServerError } from "@/lib/conversations/server";

export type AttachmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  messageId?: string;
  attachmentIds?: string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function actionError(message: string): AttachmentActionState {
  return { status: "error", message };
}

export async function sendAttachmentMessage(
  _previousState: AttachmentActionState,
  formData: FormData,
): Promise<AttachmentActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const nonce = String(formData.get("nonce") ?? "");
  const kind = String(formData.get("kind") ?? "") as ConversationAttachmentKind;
  const files = formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(nonce)) {
    return actionError("La solicitud de adjuntos es inválida.");
  }
  if (kind !== "IMAGE" && kind !== "FILE") {
    return actionError("Elegí un tipo de adjunto válido.");
  }
  if (files.length < 1 || files.length > maxConversationAttachmentsPerMessage) {
    return actionError(
      `Podés adjuntar entre 1 y ${maxConversationAttachmentsPerMessage} archivos por mensaje.`,
    );
  }

  for (const file of files) {
    const validation = conversationAttachmentSchema.safeParse({
      kind,
      mimeType: file.type,
      fileSizeBytes: file.size,
      originalName: file.name,
    });
    if (!validation.success) {
      return actionError(
        "Uno de los archivos no es compatible o supera los límites permitidos.",
      );
    }
  }

  try {
    const messageId = await createConversationAttachmentMessage(
      conversationId,
      kind,
      nonce,
    );
    const uploaded = [];
    for (const file of files) {
      uploaded.push(
        await uploadConversationAttachment({
          conversationId,
          messageId,
          kind,
          file,
        }),
      );
    }

    return {
      status: "success",
      message: files.length === 1 ? "Archivo enviado." : "Archivos enviados.",
      messageId,
      attachmentIds: uploaded.map((attachment) => attachment.id),
    };
  } catch (error) {
    if (error instanceof ConversationServerError) {
      return actionError(error.message);
    }
    return actionError("No pudimos enviar los archivos. Intentá nuevamente.");
  }
}
