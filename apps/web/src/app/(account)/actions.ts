"use server";

import {
  profileUpdateSchema,
  privateProfileUpdateSchema,
} from "@changas/validation";
import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

const profileAvatarBucket = "profile-avatars";
const profileAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const profileAvatarMaxBytes = 262_144;

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function updatePublicProfile(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileUpdateSchema.safeParse({
    displayName: getFormString(formData, "displayName"),
    publicZone: getFormString(formData, "publicZone"),
    bio: getFormString(formData, "bio"),
  });

  if (!parsed.success) {
    return { error: "Revisá los datos del perfil público." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      public_zone: parsed.data.publicZone || null,
      bio: parsed.data.bio || null,
    })
    .eq("id", user.id);

  if (!error) {
    revalidatePath("/account");
    revalidatePath("/account/profile");
  }

  return error
    ? { error: "No pudimos guardar tu información pública." }
    : { success: "Perfil público actualizado." };
}

export async function saveProfileAvatarUpload(input: {
  path: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ ok: true; avatarUrl: string } | { ok: false; error: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const { path, mimeType, sizeBytes } = input;
  const segments = path.split("/").filter(Boolean);
  if (
    segments.length !== 2 ||
    segments[0] !== user.id ||
    !profileAvatarMimeTypes.has(mimeType) ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > profileAvatarMaxBytes
  ) {
    return { ok: false, error: "El avatar subido no es válido." };
  }

  const fileName = segments[1]!;
  const { data: objects, error: listError } = await supabase.storage
    .from(profileAvatarBucket)
    .list(user.id, { search: fileName, limit: 10 });
  const object = objects?.find((entry) => entry.name === fileName);
  const metadata = object?.metadata as
    { mimetype?: string; size?: number | string } | undefined;

  if (
    listError ||
    !object ||
    (metadata?.mimetype && metadata.mimetype !== mimeType) ||
    (metadata?.size && Number(metadata.size) !== sizeBytes)
  ) {
    return { ok: false, error: "No pudimos verificar el avatar subido." };
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const avatarUrl = `/api/avatar/${path}`;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from(profileAvatarBucket).remove([path]);
    return { ok: false, error: "No pudimos guardar tu nueva foto." };
  }

  const oldPrefix = `/api/avatar/${user.id}/`;
  if (
    currentProfile?.avatar_url?.startsWith(oldPrefix) &&
    currentProfile.avatar_url !== avatarUrl
  ) {
    const oldPath = currentProfile.avatar_url.slice("/api/avatar/".length);
    await supabase.storage.from(profileAvatarBucket).remove([oldPath]);
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, avatarUrl };
}

export async function updatePrivateIdentity(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = privateProfileUpdateSchema.safeParse({
    legalName: getFormString(formData, "legalName"),
    privatePhone: getFormString(formData, "privatePhone"),
    dateOfBirth: getFormString(formData, "dateOfBirth") || undefined,
    exactAddress: getFormString(formData, "exactAddress"),
    dniNumber: getFormString(formData, "dniNumber"),
  });

  if (!parsed.success) {
    return { error: "Revisá los datos privados." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const { error } = await supabase.from("profile_private").upsert(
    {
      user_id: user.id,
      legal_name: parsed.data.legalName || null,
      private_phone: parsed.data.privatePhone || null,
      date_of_birth: parsed.data.dateOfBirth || null,
      exact_address: parsed.data.exactAddress || null,
      dni_number: parsed.data.dniNumber || null,
    },
    { onConflict: "user_id" },
  );

  if (!error) revalidatePath("/account/identity");

  return error
    ? { error: "No pudimos guardar tu información privada." }
    : { success: "Datos privados actualizados." };
}

export async function updateAccount(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const publicResult = await updatePublicProfile(previousState, formData);
  if (publicResult.error) return publicResult;

  const privateResult = await updatePrivateIdentity(previousState, formData);
  if (privateResult.error) return privateResult;

  return { success: "Perfil actualizado." };
}
