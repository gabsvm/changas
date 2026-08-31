import { createClient } from "@/lib/supabase/server";
import { ConversationServerError } from "./server";

export type ConversationMessage = {
  message_id: string;
  conversation_id: string;
  sender_user_id: string | null;
  kind: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  body: string | null;
  created_at: string;
};

export type MessageCursor = {
  beforeCreatedAt?: string;
  beforeId?: string;
};

type RpcError = { code?: string | null } | null;

type MessageRpcClient = {
  rpc(
    name: "send_conversation_text",
    args: {
      target_conversation_id: string;
      message_body: string;
      message_nonce: string;
    },
  ): Promise<{ data: string | null; error: RpcError }>;
  rpc(
    name: "list_conversation_messages",
    args: {
      target_conversation_id: string;
      before_created_at: string | null;
      before_id: string | null;
      page_size: number;
    },
  ): Promise<{ data: ConversationMessage[] | null; error: RpcError }>;
};

function mapMessageError(error: RpcError): ConversationServerError {
  if (error?.code === "42501") {
    return new ConversationServerError(
      "FORBIDDEN",
      "No podés enviar mensajes en esta conversación.",
    );
  }
  if (error?.code === "42900") {
    return new ConversationServerError(
      "CONFLICT",
      "Estás enviando mensajes demasiado rápido. Esperá un momento.",
    );
  }
  if (error?.code === "22023" || error?.code === "23505") {
    return new ConversationServerError(
      "CONFLICT",
      "No pudimos enviar ese mensaje con el estado actual.",
    );
  }
  return new ConversationServerError(
    "TRANSIENT",
    "No pudimos completar la acción. Intentá nuevamente.",
  );
}

async function getMessageRpcClient(): Promise<MessageRpcClient> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ConversationServerError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para usar mensajes.",
    );
  }

  return supabase as unknown as MessageRpcClient;
}

export async function sendConversationText(
  conversationId: string,
  body: string,
  nonce: string,
): Promise<string> {
  const rpc = await getMessageRpcClient();
  const { data, error } = await rpc.rpc("send_conversation_text", {
    target_conversation_id: conversationId,
    message_body: body,
    message_nonce: nonce,
  });

  if (error) throw mapMessageError(error);
  if (!data) throw mapMessageError(null);
  return data;
}

export async function listConversationMessages(
  conversationId: string,
  cursor: MessageCursor = {},
): Promise<ConversationMessage[]> {
  const rpc = await getMessageRpcClient();
  const { data, error } = await rpc.rpc("list_conversation_messages", {
    target_conversation_id: conversationId,
    before_created_at: cursor.beforeCreatedAt ?? null,
    before_id: cursor.beforeId ?? null,
    page_size: 50,
  });

  if (error) throw mapMessageError(error);
  return [...(data ?? [])].reverse();
}
