import { notFound, redirect } from "next/navigation";

import { ConversationThreadTextProbe } from "@/components/conversations/conversation-thread-text-probe";
import { listConversationAttachments } from "@/lib/conversations/attachments";
import { listConversationMessages } from "@/lib/conversations/messages";
import {
  ConversationServerError,
  getConversationContext,
  getMyConversationBlockState,
} from "@/lib/conversations/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadThreadData(conversationId: string) {
  console.info("[phase04-thread] load:start");

  try {
    const [context, messages, blockedUserId] = await Promise.all([
      getConversationContext(conversationId),
      listConversationMessages(conversationId),
      getMyConversationBlockState(conversationId),
    ]);

    console.info("[phase04-thread] load:rpc-complete", {
      hasContext: Boolean(context),
      messageCount: messages.length,
      hasBlockedUser: Boolean(blockedUserId),
    });

    if (!context) notFound();

    const attachments = await listConversationAttachments(
      messages.map((message) => message.message_id),
    );

    console.info("[phase04-thread] load:complete", {
      messageCount: messages.length,
      attachmentCount: attachments.length,
    });

    return { context, messages, blockedUserId, attachments };
  } catch (error) {
    console.error("[phase04-thread] load:error", error);

    if (
      error instanceof ConversationServerError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      notFound();
    }
    throw error;
  }
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  console.info("[phase04-thread] page:start");

  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.info("[phase04-thread] page:auth-complete", {
    hasUser: Boolean(user),
  });

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/messages/${conversationId}`)}`,
    );
  }

  const { context, messages, blockedUserId, attachments } =
    await loadThreadData(conversationId);
  const currentUserIsClient = user.id === context.client_user_id;
  const peerUserId = currentUserIsClient
    ? context.provider_user_id
    : context.client_user_id;
  const peerName = currentUserIsClient
    ? context.provider_display_name
    : context.client_display_name;
  const initialTextNonce = crypto.randomUUID();

  console.info("[phase04-thread] page:props-ready", {
    currentUserIsClient,
    hasPeerName: peerName.length > 0,
    hasServiceTitle: context.service_title.length > 0,
    messageCount: messages.length,
    attachmentCount: attachments.length,
    initiallyBlockedByMe: blockedUserId === peerUserId,
    hasTextNonce: initialTextNonce.length > 0,
  });

  return (
    <section className="py-4 sm:py-6">
      <ConversationThreadTextProbe
        conversationId={conversationId}
        peerName={peerName}
        serviceTitle={context.service_title}
        initialTextNonce={initialTextNonce}
      />
    </section>
  );
}
