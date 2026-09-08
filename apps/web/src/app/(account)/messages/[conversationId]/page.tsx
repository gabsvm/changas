import { notFound, redirect } from "next/navigation";

import { ConversationThread } from "@/components/conversations/conversation-thread";
import { ProposalCard } from "@/components/conversations/proposal-card";
import { ProposalComposer } from "@/components/conversations/proposal-composer";
import { listConversationAttachments } from "@/lib/conversations/attachments";
import { listConversationMessages } from "@/lib/conversations/messages";
import {
  ConversationServerError,
  getConversationContext,
  getMyConversationBlockState,
} from "@/lib/conversations/server";
import {
  listConversationProposals,
  ProposalServerError,
} from "@/lib/proposals/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadThreadData(conversationId: string) {
  try {
    const [context, messages, blockedUserId, proposals] = await Promise.all([
      getConversationContext(conversationId),
      listConversationMessages(conversationId),
      getMyConversationBlockState(conversationId),
      listConversationProposals(conversationId),
    ]);

    if (!context) notFound();

    const attachments = await listConversationAttachments(
      messages.map((message) => message.message_id),
    );

    return { context, messages, blockedUserId, attachments, proposals };
  } catch (error) {
    if (
      (error instanceof ConversationServerError ||
        error instanceof ProposalServerError) &&
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
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/messages/${conversationId}`)}`,
    );
  }

  const { context, messages, blockedUserId, attachments, proposals } =
    await loadThreadData(conversationId);
  const currentUserIsClient = user.id === context.client_user_id;
  const peerUserId = currentUserIsClient
    ? context.provider_user_id
    : context.client_user_id;
  const peerName = currentUserIsClient
    ? context.provider_display_name
    : context.client_display_name;
  const threadVersion = `${messages.at(-1)?.message_id ?? "empty"}:${attachments.length}:${blockedUserId ?? "none"}`;
  const initialTextNonce = crypto.randomUUID();
  const initialAttachmentNonce = crypto.randomUUID();
  const allowFakePayments = process.env.NODE_ENV !== "production";

  return (
    <section className="-mx-5 sm:mx-0 sm:space-y-4 sm:py-6">
      <div className="mx-auto hidden w-full max-w-4xl space-y-3 sm:block">
        <ProposalComposer
          conversationId={conversationId}
          currentUserIsClient={currentUserIsClient}
        />
        {proposals.length > 0 ? (
          <section
            className="space-y-3"
            aria-label="Propuestas de la conversación"
          >
            {proposals.map((proposal) => (
              <ProposalCard
                key={`${proposal.proposal_id}:${proposal.current_version_id}:${proposal.proposal_status}`}
                proposal={proposal}
                conversationId={conversationId}
                currentUserId={user.id}
                clientUserId={context.client_user_id}
                providerUserId={context.provider_user_id}
                allowFakePayments={allowFakePayments}
              />
            ))}
          </section>
        ) : null}
      </div>

      <div className="border-ink/10 bg-canvas border-b px-3 py-2 sm:hidden">
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 text-sm font-extrabold">
            <span>
              Acuerdos y propuestas
              {proposals.length > 0 ? ` · ${proposals.length}` : ""}
            </span>
            <span className="text-moss text-xs group-open:rotate-180" aria-hidden="true">
              ▼
            </span>
          </summary>
          <div className="space-y-3 pb-3">
            <ProposalComposer
              conversationId={conversationId}
              currentUserIsClient={currentUserIsClient}
            />
            {proposals.map((proposal) => (
              <ProposalCard
                key={`mobile:${proposal.proposal_id}:${proposal.current_version_id}:${proposal.proposal_status}`}
                proposal={proposal}
                conversationId={conversationId}
                currentUserId={user.id}
                clientUserId={context.client_user_id}
                providerUserId={context.provider_user_id}
                allowFakePayments={allowFakePayments}
              />
            ))}
          </div>
        </details>
      </div>

      <ConversationThread
        key={threadVersion}
        conversationId={conversationId}
        currentUserId={user.id}
        peerUserId={peerUserId}
        peerName={peerName}
        serviceTitle={context.service_title}
        providerHref={`/p/${context.provider_slug}/${context.service_slug}`}
        initialMessages={messages}
        initialAttachments={attachments}
        initiallyBlockedByMe={blockedUserId === peerUserId}
        initialTextNonce={initialTextNonce}
        initialAttachmentNonce={initialAttachmentNonce}
      />
    </section>
  );
}
