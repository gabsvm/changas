"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { mergeConversationMessages } from "@changas/domain";

import {
  sendTextMessage,
  type SendTextMessageState,
} from "@/app/(account)/messages/actions";
import {
  sendAttachmentMessage,
  type AttachmentActionState,
} from "@/app/(account)/messages/attachment-actions";
import {
  loadOlderMessages,
  markConversationReadAction,
  setConversationBlocked,
  submitConversationReport,
  type ReportConversationState,
} from "@/app/(account)/messages/thread-actions";
import type { ConversationAttachmentSummary } from "@/lib/conversations/attachments";
import type { ConversationMessage } from "@/lib/conversations/messages";
import { createClient } from "@/lib/supabase/client";

const textInitialState: SendTextMessageState = {
  status: "IDLE",
  message: "",
};
const attachmentInitialState: AttachmentActionState = { status: "idle" };
const reportInitialState: ReportConversationState = {
  status: "IDLE",
  message: "",
};

type RealtimeMessageRow = {
  id?: unknown;
  conversation_id?: unknown;
  sender_user_id?: unknown;
  kind?: unknown;
  body?: unknown;
  created_at?: unknown;
};

function normalizeRealtimeMessage(
  row: RealtimeMessageRow,
  conversationId: string,
): ConversationMessage | null {
  if (
    typeof row.id !== "string" ||
    row.conversation_id !== conversationId ||
    typeof row.created_at !== "string" ||
    !["TEXT", "IMAGE", "FILE", "SYSTEM"].includes(String(row.kind))
  ) {
    return null;
  }

  return {
    message_id: row.id,
    conversation_id: conversationId,
    sender_user_id:
      typeof row.sender_user_id === "string" ? row.sender_user_id : null,
    kind: row.kind as ConversationMessage["kind"],
    body: typeof row.body === "string" ? row.body : null,
    created_at: row.created_at,
  };
}

export function ConversationThread({
  conversationId,
  currentUserId,
  peerUserId,
  peerName,
  serviceTitle,
  providerHref,
  initialMessages,
  initialAttachments,
  initiallyBlockedByMe,
  initialTextNonce,
  initialAttachmentNonce,
}: {
  conversationId: string;
  currentUserId: string;
  peerUserId: string;
  peerName: string;
  serviceTitle: string;
  providerHref: string;
  initialMessages: ConversationMessage[];
  initialAttachments: ConversationAttachmentSummary[];
  initiallyBlockedByMe: boolean;
  initialTextNonce: string;
  initialAttachmentNonce: string;
}) {
  const router = useRouter();
  const refreshThread = useCallback(() => router.refresh(), [router]);
  const [messages, setMessages] = useState(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialMessages.length === 50);
  const [loadingOlder, startOlderTransition] = useTransition();
  const [blockedByMe, setBlockedByMe] = useState(initiallyBlockedByMe);
  const [changingBlock, startBlockTransition] = useTransition();
  const connectedOnce = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}:messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = normalizeRealtimeMessage(
            payload.new as RealtimeMessageRow,
            conversationId,
          );
          if (!incoming) return;

          setMessages((current) =>
            mergeConversationMessages(current, [incoming]),
          );

          if (incoming.kind === "IMAGE" || incoming.kind === "FILE") {
            window.setTimeout(refreshThread, 350);
          }
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (connectedOnce.current) refreshThread();
        connectedOnce.current = true;
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, refreshThread]);

  const latestMessageId = messages.at(-1)?.message_id;
  useEffect(() => {
    if (!latestMessageId) return;
    void markConversationReadAction(conversationId, latestMessageId).catch(
      () => undefined,
    );
  }, [conversationId, latestMessageId]);

  function loadOlder() {
    const first = messages[0];
    if (!first || loadingOlder) return;

    startOlderTransition(async () => {
      const older = await loadOlderMessages(
        conversationId,
        first.created_at,
        first.message_id,
      );
      setMessages((current) => mergeConversationMessages(older, current));
      setHasOlder(older.length === 50);
    });
  }

  function toggleBlock() {
    startBlockTransition(async () => {
      const next = !blockedByMe;
      await setConversationBlocked(conversationId, peerUserId, next);
      setBlockedByMe(next);
      refreshThread();
    });
  }

  const attachmentsByMessage = useMemo(() => {
    const map = new Map<string, ConversationAttachmentSummary[]>();
    for (const attachment of initialAttachments) {
      const items = map.get(attachment.messageId) ?? [];
      items.push(attachment);
      map.set(attachment.messageId, items);
    }
    return map;
  }, [initialAttachments]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white/70 shadow-[0_20px_70px_rgba(22,56,50,0.08)] sm:min-h-[calc(100dvh-4rem)]">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-canvas/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/70 text-lg"
            aria-label="Volver a mensajes"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{peerName}</p>
            <Link
              href={providerHref}
              className="block truncate text-xs text-ink/55 underline-offset-4 hover:underline"
            >
              {serviceTitle}
            </Link>
          </div>
          <details className="relative">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-ink/10 bg-white/70 text-lg">
              ···
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-ink/10 bg-canvas p-3 shadow-xl">
              <button
                type="button"
                onClick={toggleBlock}
                disabled={changingBlock}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
              >
                {blockedByMe ? "Desbloquear persona" : "Bloquear persona"}
              </button>
              <ReportForm conversationId={conversationId} />
            </div>
          </details>
        </div>
        {blockedByMe ? (
          <div className="mt-3 rounded-xl bg-terracotta/10 px-3 py-2 text-xs leading-5 text-terracotta">
            Bloqueaste a esta persona. El historial se conserva, pero no podés
            enviar nuevos mensajes hasta desbloquearla.
          </div>
        ) : null}
      </header>

      <main className="flex-1 px-3 py-5 sm:px-6" aria-live="polite">
        {hasOlder ? (
          <div className="mb-5 text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-ink/10 bg-canvas px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {loadingOlder ? "Cargando…" : "Cargar mensajes anteriores"}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="font-display text-2xl font-semibold">
              Empezá la conversación
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Este chat está asociado a {serviceTitle}. Acordá alcance y tiempos
              antes de avanzar.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <MessageBubble
                key={message.message_id}
                message={message}
                own={message.sender_user_id === currentUserId}
                attachments={
                  attachmentsByMessage.get(message.message_id) ?? []
                }
              />
            ))}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-ink/10 bg-canvas/95 p-3 backdrop-blur sm:p-4">
        {blockedByMe ? (
          <button
            type="button"
            onClick={toggleBlock}
            disabled={changingBlock}
            className="button-secondary w-full"
          >
            Desbloquear para volver a escribir
          </button>
        ) : (
          <>
            <TextComposer
              conversationId={conversationId}
              initialNonce={initialTextNonce}
              onSent={refreshThread}
            />
            <AttachmentComposer
              conversationId={conversationId}
              initialNonce={initialAttachmentNonce}
              onSent={refreshThread}
            />
          </>
        )}
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  own,
  attachments,
}: {
  message: ConversationMessage;
  own: boolean;
  attachments: ConversationAttachmentSummary[];
}) {
  if (message.kind === "SYSTEM") {
    return (
      <div className="mx-auto my-4 max-w-lg rounded-xl bg-moss/10 px-4 py-3 text-center text-xs leading-5 text-moss">
        {message.body ?? "Actividad de Changas"}
      </div>
    );
  }

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <article
        className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[72%] ${
          own
            ? "rounded-br-md bg-ink text-white"
            : "rounded-bl-md border border-ink/10 bg-white text-ink"
        }`}
      >
        {message.body ? (
          <p className="whitespace-pre-wrap">{message.body}</p>
        ) : null}
        {attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={`/messages/attachments/${attachment.id}`}
                className={`block rounded-xl border px-3 py-2 ${
                  own
                    ? "border-white/20 bg-white/10"
                    : "border-ink/10 bg-canvas"
                }`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="block truncate font-semibold">
                  {attachment.mimeType.startsWith("image/")
                    ? "Imagen"
                    : "Archivo"}{" "}
                  · {attachment.originalName}
                </span>
                <span
                  className={`text-[11px] ${
                    own ? "text-white/65" : "text-ink/50"
                  }`}
                >
                  {formatBytes(attachment.sizeBytes)}
                </span>
              </a>
            ))}
          </div>
        ) : message.kind === "IMAGE" || message.kind === "FILE" ? (
          <p className={own ? "text-white/65" : "text-ink/55"}>
            Preparando adjunto…
          </p>
        ) : null}
        <time
          className={`mt-1.5 block text-right text-[10px] ${
            own ? "text-white/55" : "text-ink/40"
          }`}
          dateTime={message.created_at}
        >
          {new Intl.DateTimeFormat("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(message.created_at))}
        </time>
      </article>
    </div>
  );
}

function TextComposer({
  conversationId,
  initialNonce,
  onSent,
}: {
  conversationId: string;
  initialNonce: string;
  onSent: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nonceRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(textInitialState);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;

    if (
      submitter instanceof HTMLButtonElement &&
      submitter.name &&
      submitter.value
    ) {
      data.set(submitter.name, submitter.value);
    }

    startTransition(async () => {
      const result = await sendTextMessage(textInitialState, data);
      setState(result);

      if (result.status === "WARNING") {
        setWarningDismissed(false);
        return;
      }

      if (result.status === "SUCCESS") {
        formRef.current?.reset();
        if (nonceRef.current) nonceRef.current.value = crypto.randomUUID();
        setWarningDismissed(false);
        onSent();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex items-end gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input ref={nonceRef} type="hidden" name="nonce" defaultValue={initialNonce} />
      <textarea
        name="body"
        onChange={() => setWarningDismissed(true)}
        placeholder="Escribí un mensaje…"
        rows={1}
        maxLength={4000}
        className="min-h-12 flex-1 resize-none rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none placeholder:text-ink/35 focus:border-moss/50"
      />
      <button
        type="submit"
        disabled={pending}
        className="grid h-12 min-w-12 place-items-center rounded-2xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "…" : "Enviar"}
      </button>
      {state.status === "WARNING" && !warningDismissed ? (
        <div className="absolute right-3 bottom-[5.1rem] left-3 rounded-2xl border border-terracotta/20 bg-[#fff7f2] p-4 shadow-lg sm:right-4 sm:left-4">
          <p className="text-sm font-semibold text-terracotta">
            Revisá antes de enviar
          </p>
          <p className="mt-1 text-xs leading-5 text-ink/65">
            {state.message}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              name="confirmLeakage"
              value="true"
              disabled={pending}
              className="rounded-full bg-terracotta px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Enviar de todos modos
            </button>
            <button
              type="button"
              onClick={() => setWarningDismissed(true)}
              className="rounded-full border border-ink/10 px-4 py-2 text-xs font-bold"
            >
              Editar mensaje
            </button>
          </div>
        </div>
      ) : null}
      {state.status === "ERROR" ? (
        <p
          className="absolute right-4 bottom-[4.75rem] left-4 rounded-xl bg-[#fff7f2] px-3 py-2 text-xs text-terracotta"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function AttachmentComposer({
  conversationId,
  initialNonce,
  onSent,
}: {
  conversationId: string;
  initialNonce: string;
  onSent: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nonceRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(attachmentInitialState);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await sendAttachmentMessage(attachmentInitialState, data);
      setState(result);

      if (result.status === "success") {
        formRef.current?.reset();
        if (nonceRef.current) nonceRef.current.value = crypto.randomUUID();
        onSent();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input ref={nonceRef} type="hidden" name="nonce" defaultValue={initialNonce} />
      <select
        name="kind"
        defaultValue="IMAGE"
        aria-label="Tipo de adjunto"
        className="h-9 rounded-full border border-ink/10 bg-white px-3 text-xs"
      >
        <option value="IMAGE">Imagen</option>
        <option value="FILE">Archivo</option>
      </select>
      <input
        type="file"
        name="attachments"
        multiple
        className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-moss/10 file:px-3 file:py-2 file:font-semibold file:text-moss"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-bold disabled:opacity-40"
      >
        {pending ? "Subiendo…" : "Adjuntar"}
      </button>
      {state.status === "error" ? (
        <p className="sr-only" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ReportForm({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(
    submitConversationReport,
    reportInitialState,
  );

  return (
    <details className="mt-1 border-t border-ink/10 pt-1">
      <summary className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold hover:bg-ink/5">
        Reportar conversación
      </summary>
      <form action={action} className="space-y-2 p-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <select
          name="category"
          required
          defaultValue=""
          className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs"
        >
          <option value="" disabled>
            Elegí un motivo
          </option>
          <option value="HARASSMENT">Acoso o maltrato</option>
          <option value="SCAM">Posible estafa</option>
          <option value="OFF_PLATFORM">Intento de sacar la operación</option>
          <option value="OTHER">Otro</option>
        </select>
        <textarea
          name="reason"
          maxLength={2000}
          rows={3}
          placeholder="Detalle opcional"
          className="w-full resize-none rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-terracotta px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar reporte"}
        </button>
        {state.message ? (
          <p
            className={`text-[11px] leading-4 ${
              state.status === "SUCCESS" ? "text-moss" : "text-terracotta"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
