import { createClient } from "@/lib/supabase/server";

export type ConversationErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TRANSIENT";

export class ConversationServerError extends Error {
  constructor(
    public readonly code: ConversationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConversationServerError";
  }
}

export type ConversationCursor = {
  beforeUpdatedAt?: string;
  beforeId?: string;
};

export type ConversationSummary = {
  conversation_id: string;
  service_id: string;
  service_title: string;
  service_slug: string;
  provider_slug: string;
  peer_user_id: string;
  peer_display_name: string;
  peer_avatar_url: string | null;
  status: "OPEN" | "BLOCKED" | "CLOSED";
  last_message_at: string | null;
  updated_at: string;
};

export type ConversationContext = {
  conversation_id: string;
  service_id: string;
  service_title: string;
  service_slug: string;
  provider_user_id: string;
  provider_slug: string;
  provider_display_name: string;
  client_user_id: string;
  client_display_name: string;
  status: "OPEN" | "BLOCKED" | "CLOSED";
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

type RpcError = { code?: string | null } | null;

type ConversationRpcClient = {
  rpc(
    name: "start_service_conversation",
    args: { target_provider_slug: string; target_service_slug: string },
  ): Promise<{ data: string | null; error: RpcError }>;
  rpc(
    name: "list_my_conversations",
    args: {
      page_size: number;
      before_updated_at: string | null;
      before_id: string | null;
    },
  ): Promise<{ data: ConversationSummary[] | null; error: RpcError }>;
  rpc(
    name: "get_conversation_context",
    args: { target_conversation_id: string },
  ): Promise<{ data: ConversationContext[] | null; error: RpcError }>;
};

function mapRpcError(error: RpcError): ConversationServerError {
  switch (error?.code) {
    case "42501":
      return new ConversationServerError(
        "FORBIDDEN",
        "No tenés permiso para acceder a esta conversación.",
      );
    case "P0002":
      return new ConversationServerError(
        "NOT_FOUND",
        "No encontramos el servicio o la conversación solicitada.",
      );
    case "22023":
    case "23505":
      return new ConversationServerError(
        "CONFLICT",
        "No pudimos completar esa acción con el estado actual.",
      );
    default:
      return new ConversationServerError(
        "TRANSIENT",
        "No pudimos completar la acción. Intentá nuevamente.",
      );
  }
}

async function getRpcClient(): Promise<ConversationRpcClient> {
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

  return supabase as unknown as ConversationRpcClient;
}

export async function startConversationFromService(
  providerSlug: string,
  serviceSlug: string,
): Promise<string> {
  const rpc = await getRpcClient();
  const { data, error } = await rpc.rpc("start_service_conversation", {
    target_provider_slug: providerSlug,
    target_service_slug: serviceSlug,
  });

  if (error) throw mapRpcError(error);
  if (!data) throw mapRpcError(null);
  return data;
}

export async function listMyConversations(
  cursor: ConversationCursor = {},
): Promise<ConversationSummary[]> {
  const rpc = await getRpcClient();
  const { data, error } = await rpc.rpc("list_my_conversations", {
    page_size: 20,
    before_updated_at: cursor.beforeUpdatedAt ?? null,
    before_id: cursor.beforeId ?? null,
  });

  if (error) throw mapRpcError(error);
  return data ?? [];
}

export async function getConversationContext(
  id: string,
): Promise<ConversationContext | null> {
  const rpc = await getRpcClient();
  const { data, error } = await rpc.rpc("get_conversation_context", {
    target_conversation_id: id,
  });

  if (error) throw mapRpcError(error);
  return data?.[0] ?? null;
}
