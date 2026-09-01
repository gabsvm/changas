"use server";

import { redirect } from "next/navigation";

import {
  ConversationServerError,
  startConversationFromService,
} from "@/lib/conversations/server";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function startServiceConversation(
  formData: FormData,
): Promise<void> {
  const providerSlug = String(formData.get("providerSlug") ?? "");
  const serviceSlug = String(formData.get("serviceSlug") ?? "");

  if (!SLUG_PATTERN.test(providerSlug) || !SLUG_PATTERN.test(serviceSlug)) {
    redirect("/buscar");
  }

  let conversationId: string;
  try {
    conversationId = await startConversationFromService(
      providerSlug,
      serviceSlug,
    );
  } catch (error) {
    if (
      error instanceof ConversationServerError &&
      error.code === "UNAUTHORIZED"
    ) {
      const next = `/p/${providerSlug}/${serviceSlug}`;
      redirect(`/login?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }

  redirect(`/messages/${conversationId}`);
}
