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
    <div className="border-ink/10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white/70 sm:min-h-[calc(100dvh-4rem)] sm:rounded-[1.75rem] sm:border sm:shadow-[0_20px_70px_rgba(32,33,36,0.08)]">
      <header className="border-ink/10 bg-canvas/96 sticky top-0 z-20 border-b px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex min-h-12 items-center gap-2 sm:gap-3">
          <Link
            href="/messages"
            className="hover:bg-moss/5 grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors"
            aria-label="Volver a mensajes"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="m14.5 5-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold sm:text-base">{peerName}</p>
            <Link
              href={providerHref}
              className="text-moss block truncate text-xs font-semibold underline-offset-4 hover:underline"
            >
              {serviceTitle}
            </Link>
          </div>
          <details className="relative">
            <summary className="hover:bg-moss/5 grid h-12 w-12 cursor-pointer list-none place-items-center rounded-2xl text-lg transition-colors">
              <span className="sr-only">Opciones de conversación</span>
              ···
            </summary>
            <div className="border-ink/10 bg-surface absolute right-0 z-30 mt-2 w-64 rounded-2xl border p-3 shadow-xl">
              <button
                type="button"
                onClick={toggleBlock}
                disabled={changingBlock}
                className="hover:bg-ink/5 min-h-12 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"
              >
                {blockedByMe ? "Desbloquear persona" : "Bloquear persona"}
              </button>
              <ReportForm conversationId={conversationId} />
            </div>
          </details>
        </div>
        {blockedByMe ? (
          <div className="bg-danger/8 text-danger mt-2 rounded-xl px-3 py-2 text-xs leading-5">
            Bloqueaste a esta persona. El historial se conserva, pero no podés
            enviar nuevos mensajes hasta desbloquearla.
          </div>
        ) : null}
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-5 sm:px-6" aria-live="polite">
        {hasOlder ? (
          <div className="mb-5 text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="border-ink/10 bg-canvas min-h-12 rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {loadingOlder ? "Cargando…" : "Cargar mensajes anteriores"}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="text-2xl font-extrabold tracking-[-0.025em]">
              Empezá la conversación
            </p>
            <p className="text-ink/60 mt-2 text-sm leading-6">
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
                attachments={attachmentsByMessage.get(message.message_id) ?? []}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mobile-safe-bottom border-ink/10 bg-canvas/96 sticky bottom-0 z-20 border-t p-3 backdrop-blur-xl sm:p-4">
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
          <div className="flex items-end gap-2">
            <AttachmentComposer
              conversationId={conversationId}
              initialNonce={initialAttachmentNonce}
              onSent={refreshThread}
            />
            <TextComposer
              conversationId={conversationId}
              initialNonce={initialTextNonce}
              onSent={refreshThread}
            />
          </div>
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
      <div className="bg-moss/8 text-moss mx-auto my-4 max-w-lg rounded-xl px-4 py-3 text-center text-xs leading-5">
        {message.body ?? "Actividad de Changas"}
      </div>
    );
  }

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <article
        className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[72%] ${
          own
            ? "bg-ink rounded-br-md text-white"
            : "border-ink/10 text-ink rounded-bl-md border bg-white"
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
    <form
      ref={formRef}
      onSubmit={submit}
      className="relative flex min-w-0 flex-1 items-end gap-2"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input
        ref={nonceRef}
        type="hidden"
        name="nonce"
        defaultValue={initialNonce}
      />
      <textarea
        name="body"
        onChange={() => setWarningDismissed(true)}
        placeholder="Escribí un mensaje…"
        rows={1}
        maxLength={4000}
        className="border-ink/10 placeholder:text-ink/35 focus:border-moss/50 min-h-12 min-w-0 flex-1 resize-none rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-orange text-ink grid h-12 min-w-12 place-items-center rounded-2xl px-3 disabled:opacity-40"
        aria-label={pending ? "Enviando mensaje" : "Enviar mensaje"}
      >
        {pending ? (
          <span aria-hidden="true">…</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="m4 12 16-8-5.8 16-2.8-6.8L4 12Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="m11.4 13.2 3.7-3.7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      {state.status === "WARNING" && !warningDismissed ? (
        <div className="border-terracotta/20 bg-surface absolute right-0 bottom-[calc(100%+0.75rem)] left-0 rounded-2xl border p-4 shadow-lg">
          <p className="text-terracotta text-sm font-semibold">
            Revisá antes de enviar
          </p>
          <p className="text-ink/65 mt-1 text-xs leading-5">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              name="confirmLeakage"
              value="true"
              disabled={pending}
              className="bg-terracotta min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Enviar de todos modos
            </button>
            <button
              type="button"
              onClick={() => setWarningDismissed(true)}
              className="border-ink/10 min-h-11 rounded-xl border px-4 py-2 text-xs font-bold"
            >
              Editar mensaje
            </button>
          </div>
        </div>
      ) : null}
      {state.status === "ERROR" ? (
        <p
          className="text-danger bg-surface absolute right-0 bottom-[calc(100%+0.75rem)] left-0 rounded-xl px-3 py-2 text-xs shadow-lg"
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
  const kindRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
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
        if (detailsRef.current) detailsRef.current.open = false;
        onSent();
      }
    });
  }

  function choose(kind: "IMAGE" | "FILE") {
    if (pending || !fileRef.current || !kindRef.current) return;
    kindRef.current.value = kind;
    fileRef.current.accept =
      kind === "IMAGE"
        ? "image/jpeg,image/png,image/webp"
        : "application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    fileRef.current.click();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="relative shrink-0">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input
        ref={nonceRef}
        type="hidden"
        name="nonce"
        defaultValue={initialNonce}
      />
      <input ref={kindRef} type="hidden" name="kind" defaultValue="IMAGE" />
      <input
        ref={fileRef}
        type="file"
        name="attachments"
        multiple
        className="sr-only"
        onChange={() => {
          if ((fileRef.current?.files?.length ?? 0) > 0) {
            formRef.current?.requestSubmit();
          }
        }}
      />

      <details ref={detailsRef} className="relative">
        <summary
          className="border-ink/10 bg-surface hover:bg-brand-yellow/10 grid h-12 w-12 cursor-pointer list-none place-items-center rounded-2xl border transition-colors"
          aria-label="Adjuntar"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="m8.5 12.5 5.9-5.9a3.2 3.2 0 0 1 4.5 4.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8-8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="border-ink/10 bg-surface absolute bottom-[calc(100%+0.65rem)] left-0 z-30 w-44 rounded-2xl border p-2 shadow-xl">
          <button
            type="button"
            disabled={pending}
            onClick={() => choose("IMAGE")}
            className="hover:bg-brand-yellow/10 min-h-12 w-full rounded-xl px-3 text-left text-sm font-bold disabled:opacity-50"
          >
            Foto o imagen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => choose("FILE")}
            className="hover:bg-brand-yellow/10 min-h-12 w-full rounded-xl px-3 text-left text-sm font-bold disabled:opacity-50"
          >
            Archivo
          </button>
        </div>
      </details>

      {pending ? (
        <span className="bg-surface text-ink/60 absolute -top-9 left-0 rounded-full px-3 py-1 text-[11px] font-bold shadow">
          Subiendo…
        </span>
      ) : null}
      {state.status === "error" ? (
        <p
          className="bg-surface text-danger absolute bottom-[calc(100%+0.75rem)] left-0 w-64 rounded-xl px-3 py-2 text-xs shadow-lg"
          role="alert"
        >
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
    <details className="border-ink/10 mt-1 border-t pt-1">
      <summary className="hover:bg-ink/5 flex min-h-12 cursor-pointer items-center rounded-xl px-3 py-2 text-sm font-semibold">
        Reportar conversación
      </summary>
      <form action={action} className="space-y-2 p-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <select
          name="category"
          required
          defaultValue=""
          className="border-ink/10 min-h-12 w-full rounded-xl border bg-white px-3 py-2 text-xs"
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
          className="border-ink/10 w-full resize-none rounded-xl border bg-white px-3 py-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-terracotta min-h-12 w-full rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar reporte"}
        </button>
        {state.message ? (
          <p
            className={`text-[11px] leading-4 ${
              state.status === "SUCCESS" ? "text-success" : "text-danger"
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
