"use server";

import { canSelfManageProviderStatus } from "@changas/domain";
import { identityDocumentSchema } from "@changas/validation";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

const identityBucket = "identity-documents";
const allowedDocumentTypes = new Set(["DNI_FRONT", "DNI_BACK", "SELFIE"]);

async function getUserAndClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function uploadProviderIdentityDocument(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const documentType = getFormString(formData, "documentType");
  const fileValue = formData.get("document");

  if (
    !(fileValue instanceof File) ||
    fileValue.size === 0 ||
    !allowedDocumentTypes.has(documentType)
  ) {
    return { error: "Elegí un documento válido." };
  }

  const metadata = identityDocumentSchema.safeParse({
    documentType,
    mimeType: fileValue.type,
    fileSizeBytes: fileValue.size,
  });

  if (!metadata.success) {
    return {
      error: "El documento debe ser JPG, PNG o PDF y pesar hasta 10 MiB.",
    };
  }

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: provider, error: providerReadError } = await supabase
    .from("provider_profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    providerReadError ||
    (provider && !canSelfManageProviderStatus(provider.status))
  ) {
    return { error: "Tu perfil de proveedor no admite nuevos documentos." };
  }

  if (!provider) {
    const { error } = await supabase.from("provider_profiles").insert({
      user_id: user.id,
      status: "PROFILE_INCOMPLETE",
      onboarding_step: 1,
    });
    if (error) return { error: "No pudimos preparar tu perfil de proveedor." };
  }

  const safeName =
    (fileValue.name || "document")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-80) || "document";
  const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(identityBucket)
    .upload(storagePath, fileValue, {
      contentType: fileValue.type,
      upsert: false,
    });
  if (uploadError) return { error: "No pudimos subir el documento." };

  const { data: previousDocument } = await supabase
    .from("provider_documents")
    .select("id, storage_path")
    .eq("user_id", user.id)
    .eq("document_type", metadata.data.documentType)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    document_type: metadata.data.documentType,
    storage_path: storagePath,
    mime_type: metadata.data.mimeType,
    file_size_bytes: metadata.data.fileSizeBytes,
  };

  const result = previousDocument
    ? await supabase
        .from("provider_documents")
        .update({
          storage_path: payload.storage_path,
          mime_type: payload.mime_type,
          file_size_bytes: payload.file_size_bytes,
        })
        .eq("id", previousDocument.id)
    : await supabase.from("provider_documents").insert(payload);

  if (result.error) {
    await supabase.storage.from(identityBucket).remove([storagePath]);
    return { error: "No pudimos registrar el documento." };
  }

  if (previousDocument?.storage_path) {
    await supabase.storage
      .from(identityBucket)
      .remove([previousDocument.storage_path]);
  }

  revalidatePath("/provider/onboarding/documents");
  revalidatePath("/provider/onboarding/review");
  return {
    success: "Documento recibido. Completá los tres requisitos antes de enviar a revisión.",
  };
}

export async function submitProviderIdentityReview(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.rpc("submit_provider_identity_review");
  if (error) {
    if (error.code === "22023") {
      return {
        error:
          "Antes de enviar, completá tu perfil, identidad y los tres documentos requeridos.",
      };
    }
    return { error: "No pudimos enviar tu identidad a revisión." };
  }

  revalidatePath("/provider/onboarding");
  revalidatePath("/provider/onboarding/documents");
  revalidatePath("/provider/onboarding/review");
  revalidatePath("/admin/identity");
  return { success: "Identidad enviada a revisión." };
}
