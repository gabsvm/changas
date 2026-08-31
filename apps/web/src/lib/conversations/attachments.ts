import {
  conversationAttachmentSchema,
  sanitizeAttachmentFilename,
} from "@changas/validation";

import { ConversationServerError } from "./server";

export const conversationAttachmentBucket = "conversation-attachments";
export const conversationAttachmentSignedUrlTtlSeconds = 300;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ConversationAttachmentKind = "IMAGE" | "FILE";

export type RegisteredConversationAttachment = {
  id: string;
  messageId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type RpcError = { code?: string | null; message?: string | null } | null;

type AttachmentRpcClient = {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null }; error: RpcError }>;
  };
  rpc(
    name: "create_conversation_attachment_message",
    args: {
      target_conversation_id: string;
      attachment_kind: ConversationAttachmentKind;
      message_nonce: string;
    },
  ): Promise<{ data: string | null; error: RpcError }>;
  rpc(
    name: "register_conversation_attachment",
    args: {
      target_message_id: string;
      object_path: string;
      attachment_mime_type: string;
      attachment_size_bytes: number;
      attachment_original_name: string;
    },
  ): Promise<{ data: string | null; error: RpcError }>;
  from(table: "message_attachments"): {
    select(columns: string): {
      eq(column: "id", value: string): {
        maybeSingle(): Promise<{
          data: {
            id: string;
            storage_path: string;
            mime_type: string;
            size_bytes: number;
            original_name: string;
          } | null;
          error: RpcError;
        }>;
      };
    };
  };
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Blob,
        options: { contentType: string; upsert: false },
      ): Promise<{ data: unknown; error: RpcError }>;
      remove(paths: string[]): Promise<{ data: unknown; error: RpcError }>;
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: RpcError }>;
    };
  };
};

function ensureUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ConversationServerError("CONFLICT", `${label} inválido.`);
  }
}

function mapAttachmentError(error: RpcError): ConversationServerError {
  switch (error?.code) {
    case "42501":
      return new ConversationServerError(
        "FORBIDDEN",
        "No tenés permiso para adjuntar archivos en esta conversación.",
      );
    case "P0002":
      return new ConversationServerError(
        "NOT_FOUND",
        "No encontramos el mensaje o archivo solicitado.",
      );
    case "22023":
    case "23505":
      return new ConversationServerError(
        "CONFLICT",
        "El archivo no cumple las reglas de esta conversación.",
      );
    default:
      return new ConversationServerError(
        "TRANSIENT",
        "No pudimos procesar el archivo. Intentá nuevamente.",
      );
  }
}

async function getAttachmentClient(): Promise<AttachmentRpcClient> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = (await createClient()) as unknown as AttachmentRpcClient;
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ConversationServerError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para adjuntar archivos.",
    );
  }

  return supabase;
}

export function buildConversationAttachmentPath(
  conversationId: string,
  messageId: string,
  originalName: string,
  randomId = crypto.randomUUID(),
): string {
  ensureUuid(conversationId, "Conversación");
  ensureUuid(messageId, "Mensaje");
  ensureUuid(randomId, "Identificador de archivo");
  const safeName = sanitizeAttachmentFilename(originalName);
  return `${conversationId}/${messageId}/${randomId}/${safeName}`;
}

export async function createConversationAttachmentMessage(
  conversationId: string,
  kind: ConversationAttachmentKind,
  nonce: string,
): Promise<string> {
  ensureUuid(conversationId, "Conversación");
  ensureUuid(nonce, "Nonce");
  const supabase = await getAttachmentClient();
  const { data, error } = await supabase.rpc(
    "create_conversation_attachment_message",
    {
      target_conversation_id: conversationId,
      attachment_kind: kind,
      message_nonce: nonce,
    },
  );

  if (error) throw mapAttachmentError(error);
  if (!data) throw mapAttachmentError(null);
  return data;
}

export async function uploadConversationAttachment(input: {
  conversationId: string;
  messageId: string;
  kind: ConversationAttachmentKind;
  file: File;
}): Promise<RegisteredConversationAttachment> {
  ensureUuid(input.conversationId, "Conversación");
  ensureUuid(input.messageId, "Mensaje");

  const parsed = conversationAttachmentSchema.safeParse({
    kind: input.kind,
    mimeType: input.file.type,
    fileSizeBytes: input.file.size,
    originalName: input.file.name,
  });
  if (!parsed.success) {
    throw new ConversationServerError(
      "CONFLICT",
      "El archivo no es compatible o supera los límites permitidos.",
    );
  }

  const supabase = await getAttachmentClient();
  const storagePath = buildConversationAttachmentPath(
    input.conversationId,
    input.messageId,
    parsed.data.originalName,
  );
  const storage = supabase.storage.from(conversationAttachmentBucket);
  const upload = await storage.upload(storagePath, input.file, {
    contentType: parsed.data.mimeType,
    upsert: false,
  });

  if (upload.error) throw mapAttachmentError(upload.error);

  const registration = await supabase.rpc("register_conversation_attachment", {
    target_message_id: input.messageId,
    object_path: storagePath,
    attachment_mime_type: parsed.data.mimeType,
    attachment_size_bytes: parsed.data.fileSizeBytes,
    attachment_original_name: parsed.data.originalName,
  });

  if (registration.error || !registration.data) {
    await storage.remove([storagePath]);
    throw mapAttachmentError(registration.error);
  }

  return {
    id: registration.data,
    messageId: input.messageId,
    storagePath,
    originalName: parsed.data.originalName,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.fileSizeBytes,
  };
}

export async function createConversationAttachmentSignedUrl(
  attachmentId: string,
): Promise<{ url: string; originalName: string; mimeType: string }> {
  ensureUuid(attachmentId, "Adjunto");
  const supabase = await getAttachmentClient();
  const attachment = await supabase
    .from("message_attachments")
    .select("id,storage_path,mime_type,size_bytes,original_name")
    .eq("id", attachmentId)
    .maybeSingle();

  if (attachment.error) throw mapAttachmentError(attachment.error);
  if (!attachment.data) throw mapAttachmentError({ code: "P0002" });

  const signed = await supabase.storage
    .from(conversationAttachmentBucket)
    .createSignedUrl(
      attachment.data.storage_path,
      conversationAttachmentSignedUrlTtlSeconds,
    );

  if (signed.error || !signed.data?.signedUrl) {
    throw mapAttachmentError(signed.error);
  }

  return {
    url: signed.data.signedUrl,
    originalName: attachment.data.original_name,
    mimeType: attachment.data.mime_type,
  };
}
