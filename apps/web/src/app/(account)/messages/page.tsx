import Link from "next/link";
import { redirect } from "next/navigation";

import {
  listMyConversations,
  type ConversationSummary,
} from "@/lib/conversations/server";
import { createClient } from "@/lib/supabase/server";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/messages");

  const conversations = await listMyConversations();

  return (
    <section className="pb-6 sm:py-10">
      <MobileAppBar title="Mensajes" />
      <div className="pt-4 sm:pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="hidden text-3xl font-bold tracking-[-0.035em] sm:block">
              Mensajes
            </h1>
            <p className="text-ink/52 max-w-[18rem] text-sm leading-5 sm:mt-1">
              Tus conversaciones sobre servicios y trabajos.
            </p>
          </div>
          <Link
            href="/buscar"
            className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.07] inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-2.5 text-sm font-bold whitespace-nowrap"
          >
            Buscar servicios{" "}
            <span className="chevron" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        {conversations.length === 0 ? (
          <EmptyState
            className="empty-state-card py-16 sm:py-20"
            title="Todavía no tenés conversaciones"
            description="Cuando consultes por un servicio, el chat va a aparecer acá."
            actionHref="/buscar"
            actionLabel="Explorar servicios"
          />
        ) : (
          <div className="consumer-card bg-surface divide-ink/[0.07] mt-4 divide-y px-3 sm:mt-6">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.conversation_id}
                conversation={conversation}
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
}: {
  conversation: ConversationSummary;
}) {
  return (
    <Link
      href={`/messages/${conversation.conversation_id}`}
      className="consumer-pressable hover:bg-ink/[0.025] flex min-h-[4.75rem] items-center gap-3 py-3 sm:px-2"
    >
      <Avatar
        name={conversation.peer_display_name}
        src={conversation.peer_avatar_url}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink truncate text-[0.95rem] font-semibold">
            {conversation.peer_display_name}
          </p>
          <time className="text-ink/40 shrink-0 text-[0.7rem]">
            {formatConversationTime(
              conversation.last_message_at ?? conversation.updated_at,
            )}
          </time>
        </div>
        <p className="text-ink/48 mt-0.5 truncate text-xs font-medium">
          {conversation.service_title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-ink/58 min-w-0 flex-1 truncate text-sm">
            {conversationPreview(conversation)}
          </p>
          {conversation.unread_count > 0 ? (
            <span className="bg-brand-pink-strong grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[0.62rem] font-bold text-white">
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
