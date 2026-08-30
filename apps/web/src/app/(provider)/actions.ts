"use server";

import { canSelfManageProviderStatus } from "@changas/domain";
import { identityDocumentSchema } from "@changas/validation";
import { redirect } from "next/navigation";

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

export async function startProviderOnboarding(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getUserAndClient();

  if (!user) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const { data: existing, error: readError } = await supabase
    .from("provider_profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    return { error: "No pudimos abrir tu onboarding." };
  }

  if (existing && !canSelfManageProviderStatus(existing.status)) {
    return {
      error: "Tu perfil de proveedor está en revisión y no admite cambios.",
    };
  }

  const { error } = await supabase.from("provider_profiles").upsert(
    {
      user_id: user.id,
      status:
        existing?.status === "IDENTITY_PENDING"
          ? "IDENTITY_PENDING"
          : "PROFILE_INCOMPLETE",
      onboarding_step: 1,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: "No pudimos iniciar tu onboarding." };
  }

  redirect("/provider/onboarding");
}

export async function saveProviderOnboarding(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const stepValue = Number.parseInt(getFormString(formData, "step"), 10);
  const step =
    Number.isInteger(stepValue) && stepValue >= 1 && stepValue <= 4
      ? stepValue
      : 1;
  const { supabase, user } = await getUserAndClient();

  if (!user) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const { data: existing, error: readError } = await supabase
    .from("provider_profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    readError ||
    (existing && !canSelfManageProviderStatus(existing.status))
  ) {
    return {
      error: "Tu perfil de proveedor no admite cambios en este momento.",
    };
  }

  const { error } = await supabase.from("provider_profiles").upsert(
    {
      user_id: user.id,
      status:
        existing?.status === "IDENTITY_PENDING"
          ? "IDENTITY_PENDING"
          : "PROFILE_INCOMPLETE",
      onboarding_step: step,
    },
    { onConflict: "user_id" },
  );

  return error
    ? { error: "No pudimos guardar el progreso." }
    : { success: "Progreso guardado." };
}

export async function uploadIdentityDocument(
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

  if (!user) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

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

    if (error) {
      return { error: "No pudimos preparar tu perfil de proveedor." };
    }
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

  if (uploadError) {
    return { error: "No pudimos subir el documento." };
  }

  const { data: previousDocument } = await supabase
    .from("provider_documents")
    .select("id, storage_path, document_type, mime_type, file_size_bytes")
    .eq("user_id", user.id)
    .eq("document_type", metadata.data.documentType)
    .maybeSingle();

  const documentPayload = {
    user_id: user.id,
    document_type: metadata.data.documentType,
    storage_path: storagePath,
    mime_type: metadata.data.mimeType,
    file_size_bytes: metadata.data.fileSizeBytes,
  };
  const metadataResult = previousDocument
    ? await supabase
        .from("provider_documents")
        .update({
          document_type: documentPayload.document_type,
          storage_path: documentPayload.storage_path,
          mime_type: documentPayload.mime_type,
          file_size_bytes: documentPayload.file_size_bytes,
        })
        .eq("id", previousDocument.id)
        .select("id")
        .single()
    : await supabase
        .from("provider_documents")
        .insert(documentPayload)
        .select("id")
        .single();

  if (metadataResult.error) {
    await supabase.storage.from(identityBucket).remove([storagePath]);
    return { error: "No pudimos registrar el documento." };
  }

  const { error: statusError } = await supabase
    .from("provider_profiles")
    .update({ status: "IDENTITY_PENDING" })
    .eq("user_id", user.id);

  if (statusError) {
    if (previousDocument) {
      await supabase
        .from("provider_documents")
        .update({
          storage_path: previousDocument.storage_path,
          mime_type: previousDocument.mime_type,
          file_size_bytes: previousDocument.file_size_bytes,
        })
        .eq("id", previousDocument.id);
    } else {
      await supabase
        .from("provider_documents")
        .delete()
        .eq("id", metadataResult.data.id);
    }
    await supabase.storage.from(identityBucket).remove([storagePath]);
    return { error: "No pudimos actualizar el estado de identidad." };
  }

  if (previousDocument && previousDocument.storage_path !== storagePath) {
    await supabase.storage
      .from(identityBucket)
      .remove([previousDocument.storage_path]);
  }

  return { success: "Documento recibido. Quedará pendiente de revisión." };
}
