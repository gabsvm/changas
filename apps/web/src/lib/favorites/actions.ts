"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

export async function toggleProviderFavorite(
  formData: FormData,
): Promise<void> {
  const providerSlug = getFormString(formData, "providerSlug");
  const returnPath = safeNextPath(
    getFormString(formData, "returnTo"),
    providerSlug ? "/p/" + providerSlug : "/",
  );
  const shouldFavorite = getFormString(formData, "shouldFavorite") === "true";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=" + encodeURIComponent(returnPath));
  }

  await supabase.rpc("set_provider_favorite", {
    should_favorite: shouldFavorite,
    target_provider_slug: providerSlug,
  });
  revalidatePath(returnPath);
  revalidatePath("/account/favorites");
  redirect(returnPath);
}
