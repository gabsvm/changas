"use server";

import { isUuid } from "@changas/validation";
import { revalidatePath } from "next/cache";

import { getJobDetail } from "@/lib/jobs/server";
import { getJobReviewState } from "@/lib/reputation/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EnqueueRpcClient = {
  rpc(
    name: "enqueue_user_notification",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string | null } | null }>;
};

/**
 * El prestador le pide al cliente una reseña cuando el trabajo está
 * COMPLETED+SETTLED y todavía no hay reseña. Dedupeado por
 * (cliente, PROVIDER_REVIEW_REQUEST, job, REVIEW): repetir el pedido no
 * genera avisos duplicados.
 */
export async function requestJobReviewNudgeAction(
  formData: FormData,
): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  if (!isUuid(jobId)) throw new Error("Trabajo inválido.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");

  const [detail, state] = await Promise.all([
    getJobDetail(jobId),
    getJobReviewState(supabase, jobId),
  ]);

  if (!state || detail.provider_user_id !== user.id) {
    throw new Error("Solo el prestador del trabajo puede pedir la reseña.");
  }
  if (detail.job_status !== "COMPLETED" || detail.settlement_status !== "SETTLED") {
    throw new Error("El trabajo todavía no está cobrado: el pedido de reseña espera al pago.");
  }
  if (state.review_id) throw new Error("Este trabajo ya tiene reseña.");

  const admin = createAdminClient() as unknown as EnqueueRpcClient;
  const { error } = await admin.rpc("enqueue_user_notification", {
    target_recipient_user_id: detail.client_user_id,
    notification_kind_value: "REVIEW",
    safe_title: "Te pidieron una reseña",
    safe_body:
      "El prestador te invita a contar cómo salió el trabajo. Solo te toma un minuto.",
    notification_action_url: `/jobs/${jobId}`,
    source_event_type_value: "PROVIDER_REVIEW_REQUEST",
    source_event_id_value: jobId,
    entity_type_value: "job",
    entity_id_value: jobId,
    push_eligible: true,
    email_eligible: true,
  });
  if (error) throw new Error("No pudimos enviar el pedido de reseña.");

  revalidatePath(`/jobs/${jobId}`);
}
