"use server";

import {
  profileUpdateSchema,
  privateProfileUpdateSchema,
} from "@changas/validation";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

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
    avatarUrl: getFormString(formData, "avatarUrl") || undefined,
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
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", user.id);

  return error
    ? { error: "No pudimos guardar tu información pública." }
    : { success: "Perfil público actualizado." };
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
