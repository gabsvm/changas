"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const OPEN_JOB_STATUSES = [
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETION_REQUESTED",
  "DISPUTED",
] as const;

// These tables are not in the generated database types yet.
type UntypedTable = {
  select(
    columns: string,
    options: { count: "exact"; head: true },
  ): {
    or(filter: string): {
      in(
        column: string,
        values: string[],
      ): PromiseLike<{ count: number | null }>;
    };
  };
  delete(): {
    eq(column: string, value: string): PromiseLike<{ error: unknown }>;
  };
};
type UntypedClient = { from(table: string): UntypedTable };

// Jobs, payments and reviews keep restrictive references to the user for
// accounting and dispute purposes, so the account is anonymised and locked
// instead of hard-deleted.
export async function deleteAccount(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = getFormString(formData, "password");
  if (getFormString(formData, "confirmation").trim() !== "ELIMINAR") {
    return { error: 'Escribí "ELIMINAR" para confirmar.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/login?next=/account/settings/delete");
  }

  const { error: passwordError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (passwordError) {
    return { error: "La contraseña no es correcta." };
  }

  const { count } = await (supabase as unknown as UntypedClient)
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .or(`client_user_id.eq.${user.id},provider_user_id.eq.${user.id}`)
    .in("status", [...OPEN_JOB_STATUSES]);
  if (count) {
    return {
      error:
        "Tenés trabajos en curso. Terminalos o cancelalos antes de eliminar la cuenta.",
    };
  }

  const admin = createAdminClient();

  // Lock the account first: a ban failure retries cleanly with zero data
  // loss, while a wipe failure after the ban still leaves access revoked.
  // (Banned-but-not-anonymized accounts mark an interrupted deletion.)
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: "876000h",
  });
  if (banError) {
    return { error: "No pudimos eliminar la cuenta. Intentá de nuevo." };
  }

  // Best-effort wipe: collect failures instead of aborting midway so one
  // broken step cannot strand the rest of the personal data.
  const wipeFailures: string[] = [];

  // Los blobs viven en el bucket privado `identity-documents`; hay que
  // borrarlos ANTES de borrar las filas de metadatos que guardan su path.
  const { data: documents } = await admin
    .from("provider_documents")
    .select("storage_path")
    .eq("user_id", user.id);
  const blobPaths = (documents ?? [])
    .map((document) => document.storage_path)
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
  if (blobPaths.length > 0) {
    const { error: blobError } = await admin.storage
      .from("identity-documents")
      .remove(blobPaths);
    if (blobError) wipeFailures.push("identity_blobs");
  }

  const steps = await Promise.all([
    admin
      .from("profiles")
      .update({
        display_name: "Cuenta eliminada",
        avatar_url: null,
        public_zone: null,
        bio: null,
      })
      .eq("id", user.id),
    admin.from("profile_private").delete().eq("user_id", user.id),
    (admin as unknown as UntypedClient)
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id),
    admin.from("provider_documents").delete().eq("user_id", user.id),
    admin
      .from("services")
      .update({ is_published: false, is_paused: true })
      .eq("provider_user_id", user.id),
  ]);
  if (steps.some((step) => step.error)) {
    wipeFailures.push("records");
  }

  const { error: providerError } = await admin
    .from("provider_profiles")
    .update({ status: "DEACTIVATED" })
    .eq("user_id", user.id);
  if (providerError) wipeFailures.push("provider_profile");

  // Revoca todos los refresh tokens del usuario para que ninguna sesión
  // existente sobreviva a la eliminación.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    const { error: revokeError } = await admin.auth.admin.signOut(
      session.access_token,
      "global",
    );
    if (revokeError) wipeFailures.push("session_revoke");
  }

  if (wipeFailures.length > 0) {
    console.error("account deletion partially failed", {
      userId: user.id,
      steps: wipeFailures,
    });
    return {
      error:
        "Tu acceso fue eliminado, pero algunos datos no se pudieron borrar automáticamente. Escribinos para completarlo.",
    };
  }

  await supabase.auth.signOut();
  redirect("/");
}
