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
    <details className="border-ink/10 rounded-2xl border bg-white/80 p-3">
      <summary className="cursor-pointer text-sm font-bold">
        {currentUserIsClient ? "Proponer un acuerdo" : "Enviar una cotización"}
      </summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label className="text-ink/60 text-xs font-semibold">
          Tipo
          <select
            name="kind"
            defaultValue={currentUserIsClient ? "QUOTE_REQUEST" : "PROVIDER_QUOTE"}
            className="border-ink/10 text-ink mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          >
            {currentUserIsClient ? (
              <>
                <option value="DIRECT_BOOKING">Reserva al precio publicado</option>
                <option value="QUOTE_REQUEST">Solicitar cotización</option>
                <option value="CLIENT_OFFER">Hacer una oferta</option>
              </>
            ) : (
              <option value="PROVIDER_QUOTE">Enviar cotización</option>
            )}
          </select>
        </label>
        <label className="text-ink/60 text-xs font-semibold">
          Precio ARS
          <input
            name="price"
            inputMode="decimal"
            placeholder="Dejar vacío si es a cotizar"
            className="border-ink/10 text-ink mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-ink/60 text-xs font-semibold sm:col-span-2">
          Alcance
          <textarea
            name="scope"
            rows={3}
            maxLength={4000}
            placeholder="Qué incluye el trabajo o qué necesitás cotizar"
            className="border-ink/10 text-ink mt-1 w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-ink/60 text-xs font-semibold">
          Inicio acordado
          <input
            type="datetime-local"
            name="scheduleStartAt"
            className="border-ink/10 text-ink mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-ink/60 text-xs font-semibold">
          Fin acordado
          <input
            type="datetime-local"
            name="scheduleEndAt"
            className="border-ink/10 text-ink mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-ink rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Enviar propuesta"}
          </button>
          {state.message ? (
            <p
              className={`text-xs ${
                state.status === "SUCCESS" ? "text-moss" : "text-terracotta"
              }`}
              role={state.status === "ERROR" ? "alert" : undefined}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
