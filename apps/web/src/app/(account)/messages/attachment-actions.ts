"use server";

import {
  createConversationAttachmentMessage,
  registerConversationAttachment,
  type ConversationAttachmentKind,
} from "@/lib/conversations/attachments";

export type AttachmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  messageId?: string;
  attachmentIds?: string[];
};

export async function prepareConversationAttachmentMessage(
  conversationId: string,
  kind: ConversationAttachmentKind,
  nonce: string,
) {
  return createConversationAttachmentMessage(conversationId, kind, nonce);
}

export async function registerConversationAttachmentUpload(input: {
  messageId: string;
  storagePath: string;
  kind: ConversationAttachmentKind;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}) {
  return registerConversationAttachment(input);
}
