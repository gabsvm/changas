"use server";

import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@changas/validation";

import { parseJobPostForm } from "@/lib/jobs/job-post-input";
import {
  createJobPost,
  JobPostServerError,
  startPostOffer,
  updateJobPostStatus,
} from "@/lib/jobs/job-posts-server";
import type { JobPostStatus } from "@/lib/supabase/database.types";

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function uuidField(formData: FormData, name: string): string {
  const value = stringField(formData, name);
  if (!isUuid(value)) throw new Error("Identificador inválido.");
  return value;
}

export async function createNeedAction(formData: FormData): Promise<void> {
  if (!arePublicNeedsEnabled()) throw new Error("Las solicitudes abiertas todavía no están habilitadas.");
  const parsed = parseJobPostForm({
    skillId: stringField(formData, "skillId"),
    title: stringField(formData, "title"),
    description: stringField(formData, "description"),
    locationText: stringField(formData, "locationText"),
    scheduleStartAt: stringField(formData, "scheduleStartAt"),
    scheduleEndAt: stringField(formData, "scheduleEndAt"),
    desiredBudgetAmount: stringField(formData, "desiredBudgetAmount"),
  });
  if (!parsed.ok) throw new Error(parsed.message);

  try {
    const nonce = stringField(formData, "idempotencyKey");
    if (!isUuid(nonce)) throw new Error("No pudimos validar el formulario. Recargá y probá de nuevo.");
    const postId = await createJobPost(parsed.data, nonce);
    revalidatePath("/needs");
    redirect(`/needs/${postId}`);
  } catch (error) {
    if (error instanceof JobPostServerError) throw new Error(error.message);
    throw error;
  }
}

const governableStatuses: JobPostStatus[] = ["OPEN", "PAUSED", "CLOSED"];

export async function governNeedAction(formData: FormData): Promise<void> {
  if (!arePublicNeedsEnabled()) throw new Error("Las solicitudes abiertas todavía no están habilitadas.");
  const postId = uuidField(formData, "postId");
  const rawStatus = stringField(formData, "status");
  const status = governableStatuses.find((candidate) => candidate === rawStatus);
  if (!status) throw new Error("Estado inválido.");

  try {
    await updateJobPostStatus(postId, status);
  } catch (error) {
    if (error instanceof JobPostServerError) throw new Error(error.message);
    throw error;
  }
  revalidatePath("/needs");
  revalidatePath(`/needs/${postId}`);
}

export async function offerOnNeedAction(formData: FormData): Promise<void> {
  if (!arePublicNeedsEnabled()) throw new Error("Las solicitudes abiertas todavía no están habilitadas.");
  const postId = uuidField(formData, "postId");
  const serviceId = uuidField(formData, "serviceId");

  try {
    const conversationId = await startPostOffer(postId, serviceId);
    revalidatePath(`/needs/${postId}`);
    redirect(`/messages/${conversationId}`);
  } catch (error) {
    if (error instanceof JobPostServerError) throw new Error(error.message);
    throw error;
  }
}
