import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMinorUnits } from "@changas/domain";

import {
  listMyConversations,
  type ConversationSummary,
} from "@/lib/conversations/server";
import { listConversationProposals } from "@/lib/proposals/server";
import { createClient } from "@/lib/supabase/server";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";

export const dynamic = "force-dynamic";

type OpenDeal = {
  statusLabel: string;
  amountLabel: string;
};

async function loadOpenDeals(
  conversationIds: string[],
): Promise<Map<string, OpenDeal>> {
  const settled = await Promise.all(
    conversationIds.map(async (conversationId) => {
      try {
        const proposals = await listConversationProposals(conversationId);
        const open = proposals.find(
          (proposal) => proposal.proposal_status === "OPEN",
        );
        if (!open) return null;
        return {
          conversationId,
          statusLabel: "Acuerdo abierto",
          amountLabel:
            open.price_amount === null
              ? "A cotizar"
              : formatMinorUnits(open.price_amount, open.currency_code),
        };
      } catch {
        return null;
      }
    }),
  );
  return new Map(
    settled
      .filter(
        (
          entry,
        ): entry is {
          conversationId: string;
          statusLabel: string;
          amountLabel: string;
        } => entry !== null,
      )
      .map((entry) => [
        entry.conversationId,
        { statusLabel: entry.statusLabel, amountLabel: entry.amountLabel },
      ]),
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawFilter = params.filter;
  const showUnreadOnly =
    (Array.isArray(rawFilter) ? rawFilter[0] : rawFilter) === "unread";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/messages");

  const conversations = await listMyConversations();
  const deals = await loadOpenDeals(
    conversations.map((conversation) => conversation.conversation_id),
  );
  const unreadTotal = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  ).length;
  const visible = showUnreadOnly
    ? conversations.filter((conversation) => conversation.unread_count > 0)
    : conversations;

  return (
    <section className="pb-6 sm:py-10">
      <MobileAppBar title="Mensajes" />
      <div className="pt-4 sm:pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="hidden text-3xl font-extrabold tracking-[-0.03em] sm:block">
              Mensajes
            </h1>
            <p className="text-ink/60 max-w-[20rem] text-sm leading-6 sm:mt-1">
              Tus conversaciones sobre servicios y trabajos.
            </p>
          </div>
          <Link
            href="/buscar"
            className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.08] inline-flex min-h-11 items-center gap-1 self-start rounded-full px-3 text-sm font-bold whitespace-nowrap"
          >
            Buscar servicios
          </Link>
        </div>

        <nav className="mt-4 flex gap-2" aria-label="Filtrar conversaciones">
          <Link
            href="/messages"
            aria-current={showUnreadOnly ? undefined : "page"}
            className={`consumer-pressable inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-bold ${
              showUnreadOnly
                ? "bg-surface border-ink/[0.08] border"
                : "bg-ink text-white"
            }`}
          >
            Todas
          </Link>
          <Link
            href="/messages?filter=unread"
            aria-current={showUnreadOnly ? "page" : undefined}
            className={`consumer-pressable inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-bold ${
              showUnreadOnly
                ? "bg-ink text-white"
                : "bg-surface border-ink/[0.08] border"
            }`}
          >
            No leídas{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
          </Link>
        </nav>

        {visible.length === 0 ? (
          showUnreadOnly ? (
            <EmptyState
              className="empty-state-card py-16 sm:py-20"
              title="No tenés mensajes sin leer"
              description="Cuando haya novedades en tus chats, van a aparecer acá."
              actionHref="/messages"
              actionLabel="Ver todas"
              actionTone="secondary"
            />
          ) : (
            <EmptyState
              className="empty-state-card py-16 sm:py-20"
              title="Todavía no tenés conversaciones"
              description="Cuando consultes por un servicio, el chat va a aparecer acá."
              actionHref="/buscar"
              actionLabel="Explorar servicios"
            />
          )
        ) : (
          <div className="consumer-card bg-surface divide-ink/[0.07] mt-4 divide-y px-3 sm:mt-6">
            {visible.map((conversation) => (
              <ConversationRow
                key={conversation.conversation_id}
                conversation={conversation}
                deal={deals.get(conversation.conversation_id) ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ConversationRow({
  conversation,
  deal,
}: {
  conversation: ConversationSummary;
  deal: OpenDeal | null;
}) {
  return (
    <Link
      href={`/messages/${conversation.conversation_id}`}
      className="consumer-pressable hover:bg-ink/[0.025] flex min-h-[76px] items-center gap-3 py-3.5 sm:px-2"
    >
      <Avatar
        name={conversation.peer_display_name}
        src={conversation.peer_avatar_url}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink truncate text-[15px] leading-6 font-bold">
            {conversation.peer_display_name}
          </p>
          <time className="text-ink/60 shrink-0 text-xs font-medium">
            {formatConversationTime(
              conversation.last_message_at ?? conversation.updated_at,
            )}
          </time>
        </div>
        <p className="text-ink/60 mt-0.5 truncate text-[13px] font-semibold">
          {conversation.service_title}
        </p>
        {deal ? (
          <p className="mt-1">
            <span className="bg-brand-orange/12 text-terracotta inline-block rounded-full px-2 py-0.5 text-[11px] font-bold">
              {deal.statusLabel} · {deal.amountLabel}
            </span>
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <p
            className={`min-w-0 flex-1 truncate text-sm leading-5 ${
              conversation.unread_count > 0
                ? "text-ink font-bold"
                : "text-ink/60"
            }`}
          >
            {conversationPreview(conversation)}
          </p>
          {conversation.unread_count > 0 ? (
            <span className="bg-brand-pink-strong grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white">
              {conversation.unread_count > 99
                ? "99+"
                : conversation.unread_count}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function conversationPreview(conversation: ConversationSummary): string {
  if (conversation.last_message_preview)
    return conversation.last_message_preview;
  switch (conversation.last_message_kind) {
    case "IMAGE":
      return "Imagen";
    case "FILE":
      return "Archivo";
    case "SYSTEM":
      return "Actualización de Changas";
    default:
      return "Conversación iniciada";
  }
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat("es-AR", {
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit" }),
  }).format(date);
}
