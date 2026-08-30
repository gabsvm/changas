"use server";

import {
  profileUpdateSchema,
  privateProfileUpdateSchema,
} from "@changas/validation";

import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

export async function updateAccount(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const publicData = {
    displayName: getFormString(formData, "displayName"),
    publicZone: getFormString(formData, "publicZone"),
    bio: getFormString(formData, "bio"),
    avatarUrl: getFormString(formData, "avatarUrl") || undefined,
  };
  const privateData = {
    legalName: getFormString(formData, "legalName"),
    privatePhone: getFormString(formData, "privatePhone"),
    dateOfBirth: getFormString(formData, "dateOfBirth") || undefined,
    exactAddress: getFormString(formData, "exactAddress"),
    dniNumber: getFormString(formData, "dniNumber"),
  };
  const parsedPublic = profileUpdateSchema.safeParse(publicData);
  const parsedPrivate = privateProfileUpdateSchema.safeParse(privateData);

  if (!parsedPublic.success || !parsedPrivate.success) {
    return { error: "Revisá los datos del perfil." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const { error: publicError } = await supabase
    .from("profiles")
    .update({
      display_name: parsedPublic.data.displayName,
      public_zone: parsedPublic.data.publicZone || null,
      bio: parsedPublic.data.bio || null,
      avatar_url: parsedPublic.data.avatarUrl || null,
    })
    .eq("id", user.id);

  if (publicError) {
    return { error: "No pudimos guardar tu información pública." };
  }

  const { error: privateError } = await supabase.from("profile_private").upsert(
    {
      user_id: user.id,
      legal_name: parsedPrivate.data.legalName || null,
      private_phone: parsedPrivate.data.privatePhone || null,
      date_of_birth: parsedPrivate.data.dateOfBirth || null,
      exact_address: parsedPrivate.data.exactAddress || null,
      dni_number: parsedPrivate.data.dniNumber || null,
    },
    { onConflict: "user_id" },
  );

  if (privateError) {
    return { error: "No pudimos guardar tu información privada." };
  }

  return { success: "Perfil actualizado." };
}
