import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  canActorTransitionProposal,
  formatMinorUnits,
  proposalKinds,
  type ProposalKind,
} from "@changas/domain";

import { ConversationThread } from "@/components/conversations/conversation-thread";
import { ProposalCard } from "@/components/conversations/proposal-card";
import { ProposalComposer } from "@/components/conversations/proposal-composer";
import { SectionHeader } from "@/components/ui/marketplace/section-header";
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
  type ProposalSummary,
} from "@/lib/proposals/server";
import { createClient } from "@/lib/supabase/server";
import {
  listConversationJobs,
  type ConversationJob,
} from "@/lib/jobs/server";
import {
  getJobNextAction,
  getJobTracking,
} from "@/components/jobs/job-tracking";
import { JOB_TERMINAL_STATUSES, getJobStatusPresentation } from "@/lib/ui/job-status";
import { GuideHeader } from "@/components/ui/guided";
import { CLIENT_HIRE_STEPS } from "@/lib/ui/guided";

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
  searchParams,
}: {
  params: Promise<{ conversationId: string }>; 
  searchParams: Promise<{ kind?: string }>;
}) {
  const { conversationId } = await params;
  const requestedKind = (await searchParams)?.kind;
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
  // Graceful when the jobs read model is unavailable: cards just lack links.
  let conversationJobs: ConversationJob[] = [];
  try {
    conversationJobs = await listConversationJobs(conversationId);
  } catch {
    conversationJobs = [];
  }
  const jobByVersion = new Map(
    conversationJobs.map((job) => [job.accepted_proposal_version_id, job.job_id]),
  );
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
  const defaultProposalKind = proposalKinds.includes(requestedKind as ProposalKind)
    ? (requestedKind as ProposalKind)
    : undefined;  const proposalStatusLabels: Record<
    ProposalSummary["proposal_status"],
    string
  > = {
    OPEN: "Acuerdo abierto",
    ACCEPTED: "Aceptada",
    REJECTED: "Rechazada",
    WITHDRAWN: "Retirada",
    EXPIRED: "Vencida",
    AWAITING_PAYMENT: "Esperando pago",
    PAYMENT_FAILED: "Pago fallido",
    PAID: "Pagada",
  };
  const proposalStatusTones: Record<
    ProposalSummary["proposal_status"],
    "neutral" | "success" | "warning" | "danger" | "brand" | "info"
  > = {
    OPEN: "brand",
    ACCEPTED: "success",
    REJECTED: "neutral",
    WITHDRAWN: "neutral",
    EXPIRED: "warning",
    AWAITING_PAYMENT: "info",
    PAYMENT_FAILED: "danger",
    PAID: "success",
  };
  const activeProposal =
    proposals.find((proposal) => proposal.proposal_status === "OPEN") ??
    proposals[0] ??
    null;
  const deal = activeProposal
    ? {
        statusLabel: proposalStatusLabels[activeProposal.proposal_status],
        statusTone: proposalStatusTones[activeProposal.proposal_status],
        amountLabel:
          activeProposal.price_amount === null
            ? "A cotizar"
            : formatMinorUnits(
                activeProposal.price_amount,
                activeProposal.currency_code,
              ),
      }
    : null;
  const openProposal =
    proposals.find((proposal) => proposal.proposal_status === "OPEN") ?? null;
  const hireSpotlight =
    openProposal !== null &&
    openProposal.price_amount !== null &&
    canActorTransitionProposal({
      actorRole: currentUserIsClient ? "CLIENT" : "PROVIDER",
      actorIsAuthor: openProposal.authored_by_user_id === user.id,
      from: openProposal.proposal_status,
      to: "ACCEPTED",
    })
      ? {
          kind: "hire" as const,
          title: `Contratar · ${formatMinorUnits(openProposal.price_amount, openProposal.currency_code)}`,
          sub: "Sin pago por adelantado. Tocá para revisar y confirmar.",
          cta: "Contratar",
          href: "#propuestas",
        }
      : null;
  const spotlightJob =
    conversationJobs.find(
      (job) => !JOB_TERMINAL_STATUSES.includes(job.job_status),
    ) ?? null;
  const spotlightTracking = spotlightJob
    ? getJobTracking(spotlightJob.job_status, null)
    : null;
  const spotlightStatus = spotlightJob
    ? getJobStatusPresentation(spotlightJob.job_status)
    : null;
  const spotlightNext = spotlightJob
    ? getJobNextAction({
        status: spotlightJob.job_status,
        isClient: currentUserIsClient,
        isProvider: !currentUserIsClient,
        settlementPending: false,
      })
    : null;
  const jobSpotlight =
    spotlightJob && spotlightTracking && spotlightStatus && spotlightNext
      ? {
          kind: "job" as const,
          title: spotlightStatus.label,
          sub: spotlightTracking.exception
            ? spotlightNext.heading
            : `Paso ${spotlightTracking.currentIndex + 1} de ${spotlightTracking.steps.length} · ${spotlightNext.heading}`,
          cta: "Ver seguimiento",
          href: `/jobs/${spotlightJob.job_id}`,
          helpHref: `/jobs/${spotlightJob.job_id}#ayuda`,
        }
      : null;
  const spotlight = hireSpotlight ?? jobSpotlight;

  return (
    <section className="space-y-4 py-4 sm:py-6">
      <GuideHeader step={3} steps={CLIENT_HIRE_STEPS} />
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
        deal={deal}
        spotlight={spotlight}
      />

      {conversationJobs.length > 0 ? (
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-0">
          <div className="border-moss/20 bg-moss/[0.06] space-y-2 rounded-2xl border px-4 py-3">
            <p className="text-sm font-bold">
              {conversationJobs.length === 1
                ? "Este chat ya tiene un servicio en marcha."
                : "Este chat ya tiene servicios en marcha."}
            </p>
            {conversationJobs.map((job) => {
              const tracking = getJobTracking(job.job_status, null);
              const status = getJobStatusPresentation(job.job_status);
              return (
                <div
                  key={job.job_id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="text-ink/70 text-[13px] font-semibold">
                    {tracking.exception
                      ? status.label
                      : `Paso ${tracking.currentIndex + 1} de ${tracking.steps.length} · ${status.label}`}
                  </span>
                  <Link
                    href={`/jobs/${job.job_id}`}
                    className="consumer-pressable text-moss inline-flex min-h-11 items-center text-sm font-extrabold"
                  >
                    Ver seguimiento →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-4xl space-y-3 px-4 sm:px-0">
        {proposals.length > 0 ? (
          <section
            className="scroll-mt-56 space-y-3"
            id="propuestas"
            aria-label="Propuestas de la conversación"
          >
            <div className="flex items-center justify-between gap-3">
              <SectionHeader
                title="Propuestas"
                badge={{ tone: "gold", icon: "tag", label: "Propuestas" }}
                className="min-w-0 flex-1"
              />
              <span
                className="inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-extrabold text-white shadow-[0_8px_20px_-8px_rgb(13_18_27/60%)] dark:shadow-[0_8px_20px_-8px_rgb(0_0_0/70%)]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #0D121B 0%, #1E293B 100%)",
                }}
                aria-label={`${proposals.length} propuestas`}
              >
                {proposals.length}
              </span>
            </div>
            {proposals.map((proposal) => (
              <ProposalCard
                key={`${proposal.proposal_id}:${proposal.current_version_id}:${proposal.proposal_status}`}
                proposal={proposal}
                conversationId={conversationId}
                currentUserId={user.id}
                clientUserId={context.client_user_id}
                providerUserId={context.provider_user_id}
                jobId={
                  proposal.accepted_version_id
                    ? (jobByVersion.get(proposal.accepted_version_id) ?? null)
                    : null
                }
              />
            ))}
          </section>
        ) : null}
        <ProposalComposer
          defaultKind={defaultProposalKind}
          conversationId={conversationId}
          currentUserIsClient={currentUserIsClient}
        />
      </div>
    </section>
  );
}
