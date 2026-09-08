"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

type IdentitySubmitRpcClient = {
  rpc(name: "submit_provider_identity_review"): Promise<{
    error: { code?: string | null; message?: string | null } | null;
  }>;
};

export async function submitProviderIdentityReview(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await (
    supabase as unknown as IdentitySubmitRpcClient
  ).rpc("submit_provider_identity_review");

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
