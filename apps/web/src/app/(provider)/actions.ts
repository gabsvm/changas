"use server";

import { canSelfManageProviderStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import {
  updatePrivateIdentity,
  updatePublicProfile,
} from "@/app/(account)/actions";
import type { ActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

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

export async function saveProviderProfileStep(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profileResult = await updatePublicProfile(previousState, formData);
  if (profileResult.error) return profileResult;

  const progressResult = await saveProviderOnboarding(previousState, formData);
  if (progressResult.error) return progressResult;

  redirect("/provider/onboarding/identity");
}

export async function saveProviderIdentityStep(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identityResult = await updatePrivateIdentity(previousState, formData);
  if (identityResult.error) return identityResult;

  const progressResult = await saveProviderOnboarding(previousState, formData);
  if (progressResult.error) return progressResult;

  redirect("/provider/onboarding/documents");
}
