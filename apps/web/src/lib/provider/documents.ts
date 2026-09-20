import "server-only";

import { isUuid } from "@changas/validation";

import {
  identityDocumentBucket,
  identityDocumentSignedUrlTtlSeconds,
} from "@/lib/admin/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type OwnerDocumentErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TRANSIENT";

export class OwnerDocumentError extends Error {
  constructor(
    readonly code: OwnerDocumentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OwnerDocumentError";
  }
}

function ensureUuid(value: string, label: string): void {
  if (!isUuid(value)) {
    throw new OwnerDocumentError("CONFLICT", `${label} inválido.`);
  }
}

export async function createOwnerIdentityDocumentSignedUrl(
  documentId: string,
): Promise<{
  url: string;
  mimeType: string;
  documentType: string;
  expiresInSeconds: number;
}> {
  ensureUuid(documentId, "Documento");

  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new OwnerDocumentError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para ver tus documentos.",
    );
  }

  const admin = createAdminClient();
  const document = await admin
    .from("provider_documents")
    .select("id,user_id,storage_path,mime_type,document_type")
    .eq("id", documentId)
    .maybeSingle();

  if (document.error) {
    throw new OwnerDocumentError(
      "TRANSIENT",
      "No pudimos consultar tu documento.",
    );
  }
  if (!document.data || document.data.user_id !== user.id) {
    throw new OwnerDocumentError(
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
    throw new OwnerDocumentError(
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
