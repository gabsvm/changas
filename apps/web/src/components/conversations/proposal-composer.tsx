"use client";

import { useActionState } from "react";

import {
  createProposalAction,
  type ProposalActionState,
} from "@/app/(account)/messages/proposal-actions";

const initialState: ProposalActionState = { status: "IDLE", message: "" };

export function ProposalComposer({
  conversationId,
  currentUserIsClient,
}: {
  conversationId: string;
  currentUserIsClient: boolean;
}) {
  const [state, action, pending] = useActionState(
    createProposalAction,
    initialState,
  );

  return (
    <details className="border-ink/[0.08] bg-surface rounded-2xl border p-4 shadow-[var(--consumer-shadow-card)]">
      <summary className="consumer-pressable inline-flex min-h-12 cursor-pointer items-center gap-2 text-[15px] font-extrabold">
        <span
          className="bg-brand-orange/15 text-terracotta grid h-9 w-9 place-items-center rounded-xl text-lg"
          aria-hidden="true"
        >
          +
        </span>
        {currentUserIsClient ? "Proponer un acuerdo" : "Enviar una cotización"}
      </summary>
      {state.message ? (
        <p
          className={
            state.status === "ERROR"
              ? "bg-danger/[0.07] text-danger mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
              : "bg-success/[0.07] text-success mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
          }
          role={state.status === "ERROR" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label className="text-ink text-sm font-bold">
          Tipo
          <select
            name="kind"
            defaultValue={
              currentUserIsClient ? "QUOTE_REQUEST" : "PROVIDER_QUOTE"
            }
            className="consumer-control text-ink mt-1.5 min-h-[52px] w-full px-3.5 text-base"
          >
            {currentUserIsClient ? (
              <>
                <option value="DIRECT_BOOKING">
                  Reserva al precio publicado
                </option>
                <option value="QUOTE_REQUEST">Solicitar cotización</option>
                <option value="CLIENT_OFFER">Hacer una oferta</option>
              </>
            ) : (
              <option value="PROVIDER_QUOTE">Enviar cotización</option>
            )}
          </select>
        </label>
        <label className="text-ink text-sm font-bold">
          Precio ARS
          <input
            name="price"
            inputMode="decimal"
            placeholder="Dejar vacío si es a cotizar"
            className="consumer-control text-ink mt-1.5 min-h-[52px] w-full px-3.5 text-base"
          />
        </label>
        <label className="text-ink text-sm font-bold sm:col-span-2">
          Alcance
          <textarea
            name="scope"
            rows={3}
            maxLength={4000}
            placeholder="Qué incluye el trabajo o qué necesitás cotizar"
            className="consumer-control text-ink mt-1.5 w-full resize-none px-3.5 py-3 text-base"
          />
        </label>
        <label className="text-ink text-sm font-bold">
          Inicio acordado
          <input
            type="datetime-local"
            name="scheduleStartAt"
            className="consumer-control text-ink mt-1.5 min-h-[52px] w-full px-3.5 text-base"
          />
        </label>
        <label className="text-ink text-sm font-bold">
          Fin acordado
          <input
            type="datetime-local"
            name="scheduleEndAt"
            className="consumer-control text-ink mt-1.5 min-h-[52px] w-full px-3.5 text-base"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="consumer-pressable bg-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold text-white disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pending ? "Guardando…" : "Enviar propuesta"}
          </button>
        </div>
      </form>
    </details>
  );
}
