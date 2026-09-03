import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const identityDocumentBucket = "identity-documents";
export const identityDocumentSignedUrlTtlSeconds = 180;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RpcError = { code?: string | null; message?: string | null } | null;
type RpcResult<T> = Promise<{ data: T | null; error: RpcError }>;

type IdentityQueueRow = {
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  legal_name: string | null;
  status: string;
  document_count: number;
  submitted_at: string | null;
  updated_at: string;
};

type IdentityCaseRow = {
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  legal_name: string | null;
  date_of_birth: string | null;
  dni_number: string | null;
  status: string;
  documents: unknown[];
  review_history: unknown[];
  updated_at: string;
};

type IdentitySessionClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: RpcError;
    }>;
  };
  rpc(name: "is_current_user_admin"): RpcResult<boolean>;
  rpc(
    name: "list_admin_identity_queue",
    args: { page_size: number; page_offset: number },
  ): RpcResult<IdentityQueueRow[]>;
  rpc(
    name: "get_admin_identity_case",
    args: { target_provider_user_id: string },
  ): RpcResult<IdentityCaseRow[]>;
  rpc(
    name: "decide_provider_identity_review",
    args: {
      target_provider_user_id: string;
      requested_decision: "APPROVE" | "REJECT";
      requested_reason: string | null;
    },
  ): RpcResult<string>;
};

export type AdminIdentityErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TRANSIENT";

export class AdminIdentityError extends Error {
  constructor(
    readonly code: AdminIdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminIdentityError";
  }
}

function ensureUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new AdminIdentityError("CONFLICT", `${label} inválido.`);
  }
}

function mapIdentityRpcError(error: RpcError): AdminIdentityError {
  switch (error?.code) {
    case "42501":
      return new AdminIdentityError(
        "FORBIDDEN",
        "No tenés permisos administrativos para esta operación.",
      );
    case "P0002":
      return new AdminIdentityError(
        "NOT_FOUND",
        "No encontramos el caso de identidad solicitado.",
      );
    case "22023":
    case "23514":
    case "55000":
      return new AdminIdentityError(
        "CONFLICT",
        "La revisión de identidad no cumple las reglas actuales.",
      );
    default:
      return new AdminIdentityError(
        "TRANSIENT",
        "No pudimos completar la operación de identidad.",
      );
  }
}

async function requireAdminSession(): Promise<{
  client: IdentitySessionClient;
  userId: string;
}> {
  const client = (await createClient()) as unknown as IdentitySessionClient;
  const userResult = await client.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    throw new AdminIdentityError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para acceder al panel administrativo.",
    );
  }

  const adminResult = await client.rpc("is_current_user_admin");
  if (adminResult.error) throw mapIdentityRpcError(adminResult.error);
  if (adminResult.data !== true) {
    throw new AdminIdentityError(
      "FORBIDDEN",
      "Esta cuenta no tiene permisos administrativos.",
    );
  }

  return { client, userId: userResult.data.user.id };
}

export async function listAdminIdentityQueue({
  pageSize = 50,
  pageOffset = 0,
}: {
  pageSize?: number;
  pageOffset?: number;
} = {}): Promise<IdentityQueueRow[]> {
  const { client } = await requireAdminSession();
  const result = await client.rpc("list_admin_identity_queue", {
    page_size: pageSize,
    page_offset: pageOffset,
  });

  if (result.error) throw mapIdentityRpcError(result.error);
  return result.data ?? [];
}

export async function getAdminIdentityCase(
  providerUserId: string,
): Promise<IdentityCaseRow> {
  ensureUuid(providerUserId, "Proveedor");
  const { client } = await requireAdminSession();
  const result = await client.rpc("get_admin_identity_case", {
    target_provider_user_id: providerUserId,
  });

  if (result.error) throw mapIdentityRpcError(result.error);
  const identityCase = result.data?.[0];
  if (!identityCase) {
    throw new AdminIdentityError(
      "NOT_FOUND",
      "No encontramos el caso de identidad solicitado.",
    );
  }
  return identityCase;
}

export async function decideAdminIdentityCase(input: {
  providerUserId: string;
  decision: "APPROVE" | "REJECT";
  reason?: string | null;
}): Promise<string> {
  ensureUuid(input.providerUserId, "Proveedor");
  const { client } = await requireAdminSession();
  const result = await client.rpc("decide_provider_identity_review", {
    target_provider_user_id: input.providerUserId,
    requested_decision: input.decision,
    requested_reason: input.reason?.trim() || null,
  });

  if (result.error) throw mapIdentityRpcError(result.error);
  if (!result.data) throw mapIdentityRpcError(null);
  return result.data;
}

export async function createAdminIdentityDocumentSignedUrl(
  documentId: string,
): Promise<{
  url: string;
  mimeType: string;
  documentType: string;
  expiresInSeconds: number;
}> {
  ensureUuid(documentId, "Documento");
  await requireAdminSession();

  const admin = createAdminClient();
  const document = await admin
    .from("provider_documents")
    .select("id,storage_path,mime_type,document_type")
    .eq("id", documentId)
    .maybeSingle();

  if (document.error) {
    throw new AdminIdentityError(
      "TRANSIENT",
      "No pudimos consultar el documento de identidad.",
    );
  }
  if (!document.data) {
    throw new AdminIdentityError(
      "NOT_FOUND",
      "No encontramos el documento solicitado.",
    );
  }

  const signed = await admin.storage
    .from(identityDocumentBucket)
    .createSignedUrl(
      document.data.storage_path,
      identityDocumentSignedUrlTtlSeconds,
    );

  if (signed.error || !signed.data?.signedUrl) {
    throw new AdminIdentityError(
      "TRANSIENT",
      "No pudimos autorizar temporalmente el documento.",
    );
  }

  return {
    url: signed.data.signedUrl,
    mimeType: document.data.mime_type,
    documentType: document.data.document_type,
    expiresInSeconds: identityDocumentSignedUrlTtlSeconds,
  };
}
