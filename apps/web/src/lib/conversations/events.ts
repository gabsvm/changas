import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { ConversationServerError } from "./server";

type SystemEventRpcClient = {
  rpc(
    name: "append_conversation_system_event",
    args: {
      target_conversation_id: string;
      event_body: string;
      event_nonce: string;
    },
  ): Promise<{
    data: string | null;
    error: { code?: string | null } | null;
  }>;
};

export async function appendConversationSystemEvent(input: {
  conversationId: string;
  body: string;
  nonce?: string;
}): Promise<string> {
  const body = input.body.trim();
  if (!body || body.length > 4000) {
    throw new ConversationServerError(
      "CONFLICT",
      "El evento interno tiene un contenido inválido.",
    );
  }

  const admin = createAdminClient() as unknown as SystemEventRpcClient;
  const { data, error } = await admin.rpc("append_conversation_system_event", {
    target_conversation_id: input.conversationId,
    event_body: body,
    event_nonce: input.nonce ?? crypto.randomUUID(),
  });

  if (error?.code === "P0002") {
    throw new ConversationServerError(
      "NOT_FOUND",
      "No encontramos la conversación para registrar el evento.",
    );
  }
  if (error || !data) {
    throw new ConversationServerError(
      "TRANSIENT",
      "No pudimos registrar el evento de la conversación.",
    );
  }

  return data;
}
