import Link from "next/link";
import { redirect } from "next/navigation";

import {
  listMyConversations,
  type ConversationSummary,
} from "@/lib/conversations/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/messages");

  const conversations = await listMyConversations();

  return (
    <section className="py-7 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Conversaciones
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Mensajes
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">
            Cada conversación conserva el contexto del servicio que estás
            coordinando.
          </p>
        </div>
        <Link href="/buscar" className="button-secondary hidden sm:inline-flex">
          Buscar servicios
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="mt-10 rounded-[1.75rem] border border-ink/10 bg-white/60 p-7 text-center sm:p-10">
          <p className="font-display text-2xl font-semibold">
            Todavía no tenés conversaciones
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/60">
            Abrí un servicio y usá “Consultar por este servicio” para iniciar un
            chat contextual.
          </p>
          <Link href="/buscar" className="button-primary mt-5">
            Explorar servicios
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white/65">
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.conversation_id}
              conversation={conversation}
            />
          ))}
        </div>
      )}
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
      className="flex min-h-24 items-center gap-3 border-b border-ink/10 px-4 py-4 transition-colors last:border-b-0 hover:bg-white/80 sm:px-5"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-moss/10 text-sm font-bold text-moss">
        {conversation.peer_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conversation.peer_avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          conversation.peer_display_name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-semibold">{conversation.peer_display_name}</p>
          <time className="shrink-0 text-[11px] text-ink/45">
            {formatConversationTime(
              conversation.last_message_at ?? conversation.updated_at,
            )}
          </time>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-moss">
          {conversation.service_title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-ink/55">
            {conversationPreview(conversation)}
          </p>
          {conversation.unread_count > 0 ? (
            <span className="grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full bg-terracotta px-1.5 text-[10px] font-bold text-white">
              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function conversationPreview(conversation: ConversationSummary): string {
  if (conversation.last_message_preview) return conversation.last_message_preview;
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
