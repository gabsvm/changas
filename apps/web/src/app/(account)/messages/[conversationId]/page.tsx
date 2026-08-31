import { notFound, redirect } from "next/navigation";

import { ConversationThread } from "@/components/conversations/conversation-thread";
import { listConversationAttachments } from "@/lib/conversations/attachments";
import { listConversationMessages } from "@/lib/conversations/messages";
import {
  ConversationServerError,
  getConversationContext,
  getMyConversationBlockState,
} from "@/lib/conversations/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/messages/${conversationId}`)}`);
  }

  try {
    const [context, messages, blockedUserId] = await Promise.all([
      getConversationContext(conversationId),
      listConversationMessages(conversationId),
      getMyConversationBlockState(conversationId),
    ]);

    if (!context) notFound();

    const attachments = await listConversationAttachments(
      messages.map((message) => message.message_id),
    );
    const currentUserIsClient = user.id === context.client_user_id;
    const peerUserId = currentUserIsClient
      ? context.provider_user_id
      : context.client_user_id;
    const peerName = currentUserIsClient
      ? context.provider_display_name
      : context.client_display_name;

    return (
      <section className="py-4 sm:py-6">
        <ConversationThread
          conversationId={conversationId}
          currentUserId={user.id}
          peerUserId={peerUserId}
          peerName={peerName}
          serviceTitle={context.service_title}
          providerHref={`/p/${context.provider_slug}/${context.service_slug}`}
          initialMessages={messages}
          initialAttachments={attachments}
          initiallyBlockedByMe={blockedUserId === peerUserId}
          initialTextNonce={crypto.randomUUID()}
          initialAttachmentNonce={crypto.randomUUID()}
        />
      </section>
    );
  } catch (error) {
    if (
      error instanceof ConversationServerError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      notFound();
    }
    throw error;
  }
}
