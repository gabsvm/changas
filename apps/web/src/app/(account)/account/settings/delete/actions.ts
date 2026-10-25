"use server";

import { jobStatuses, isTerminalJobStatus } from "@changas/domain";
import { redirect } from "next/navigation";

import { requiresPasswordConfirmation } from "@/lib/auth/account-deletion";
import type { AuthActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Every non-terminal status blocks deletion (derived from the domain so new
// statuses cannot silently slip past this check).
const OPEN_JOB_STATUSES = jobStatuses.filter(
  (status) => !isTerminalJobStatus(status),
);

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
      ): PromiseLike<{ count: number | null; error: unknown }>;
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

  if (requiresPasswordConfirmation(user)) {
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (passwordError) {
      return { error: "La contraseña no es correcta." };
    }
  }

  const { count, error: jobsError } = await (supabase as unknown as UntypedClient)
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .or(`client_user_id.eq.${user.id},provider_user_id.eq.${user.id}`)
    .in("status", OPEN_JOB_STATUSES);
  if (jobsError || count === null) {
    return { error: "No pudimos verificar tus trabajos. Intentá de nuevo." };
  }
  if (count > 0) {
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
  const { data: documents, error: documentReadError } = await admin
    .from("provider_documents")
    .select("storage_path")
    .eq("user_id", user.id);
  const blobPaths = (documents ?? [])
    .map((document) => document.storage_path)
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
  if (documentReadError) wipeFailures.push("identity_metadata_read");
  let blobRemovalFailed = false;
  if (!documentReadError && blobPaths.length > 0) {
    const { error: blobError } = await admin.storage
      .from("identity-documents")
      .remove(blobPaths);
    if (blobError) {
      wipeFailures.push("identity_blobs");
      blobRemovalFailed = true;
    }
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
    documentReadError || blobRemovalFailed
      ? Promise.resolve({ error: new Error("identity_documents_retained") })
      : admin.from("provider_documents").delete().eq("user_id", user.id),
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
