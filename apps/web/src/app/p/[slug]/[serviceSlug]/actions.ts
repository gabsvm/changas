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

  try {
    const conversationId = await startConversationFromService(
      providerSlug,
      serviceSlug,
    );
    redirect(`/messages/${conversationId}`);
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
}
