"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import {
  sendTextMessage,
  type SendTextMessageState,
} from "@/app/(account)/messages/actions";
import { setConversationBlocked } from "@/app/(account)/messages/thread-actions";

const initialState: SendTextMessageState = {
  status: "IDLE",
  message: "",
};

export function ConversationThreadTextProbe({
  conversationId,
  peerUserId,
  peerName,
  serviceTitle,
  initialTextNonce,
  initiallyBlockedByMe,
}: {
  conversationId: string;
  peerUserId: string;
  peerName: string;
  serviceTitle: string;
  initialTextNonce: string;
  initiallyBlockedByMe: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nonceRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(initialState);
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [blockedByMe, setBlockedByMe] = useState(initiallyBlockedByMe);
  const [changingBlock, startBlockTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "");
    const submitter = (event.nativeEvent as SubmitEvent).submitter;

    if (
      submitter instanceof HTMLButtonElement &&
      submitter.name &&
      submitter.value
    ) {
      data.set(submitter.name, submitter.value);
    }

    startTransition(async () => {
      const result = await sendTextMessage(initialState, data);
      setState(result);

      if (result.status === "WARNING") {
        setWarningDismissed(false);
        return;
      }

      if (result.status === "SUCCESS") {
        setSentMessages((current) => [...current, body]);
        formRef.current?.reset();
        if (nonceRef.current) nonceRef.current.value = crypto.randomUUID();
        setWarningDismissed(false);
      }
    });
  }

  function toggleBlock() {
    startBlockTransition(async () => {
      const next = !blockedByMe;
      await setConversationBlocked(conversationId, peerUserId, next);
      setBlockedByMe(next);
    });
  }

  return (
    <div className="border-ink/10 mx-auto w-full max-w-4xl rounded-[1.75rem] border bg-white/70 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{peerName}</p>
          <p className="text-ink/60 text-sm">{serviceTitle}</p>
        </div>
        <details>
          <summary className="border-ink/10 grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border bg-white/70 text-lg">
            ···
          </summary>
          <div className="border-ink/10 mt-2 rounded-2xl border bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={toggleBlock}
              disabled={changingBlock}
              className="rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {blockedByMe ? "Desbloquear persona" : "Bloquear persona"}
            </button>
          </div>
        </details>
      </div>

      <div className="mt-6 space-y-2">
        {sentMessages.map((message) => (
          <p
            key={message}
            className="bg-ink rounded-2xl px-4 py-3 text-sm text-white"
          >
            {message}
          </p>
        ))}
      </div>

      {blockedByMe ? (
        <button
          type="button"
          onClick={toggleBlock}
          disabled={changingBlock}
          className="button-secondary mt-6 w-full"
        >
          Desbloquear para volver a escribir
        </button>
      ) : (
        <form
          ref={formRef}
          onSubmit={submit}
          className="relative mt-6 flex items-end gap-2"
        >
          <input type="hidden" name="conversationId" value={conversationId} />
          <input
            ref={nonceRef}
            type="hidden"
            name="nonce"
            defaultValue={initialTextNonce}
          />
          <textarea
            name="body"
            onChange={() => setWarningDismissed(true)}
            placeholder="Escribí un mensaje…"
            rows={1}
            maxLength={4000}
            className="border-ink/10 min-h-12 flex-1 resize-none rounded-2xl border bg-white px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-ink h-12 rounded-2xl px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "…" : "Enviar"}
          </button>

          {state.status === "WARNING" && !warningDismissed ? (
            <div className="border-terracotta/20 absolute right-0 bottom-16 left-0 rounded-2xl border bg-[#fff7f2] p-4 shadow-lg">
              <p className="text-terracotta text-sm font-semibold">
                Revisá antes de enviar
              </p>
              <p className="text-ink/65 mt-1 text-xs leading-5">
                {state.message}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  name="confirmLeakage"
                  value="true"
                  disabled={pending}
                  className="bg-terracotta rounded-full px-4 py-2 text-xs font-bold text-white"
                >
                  Enviar de todos modos
                </button>
                <button
                  type="button"
                  onClick={() => setWarningDismissed(true)}
                  className="border-ink/10 rounded-full border px-4 py-2 text-xs font-bold"
                >
                  Editar mensaje
                </button>
              </div>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
