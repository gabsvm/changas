"use client";

import { useActionState, useState } from "react";

import { proposalKinds, type ProposalKind } from "@changas/domain";

import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SuccessCheck } from "@/components/ui/marketplace/success-check";
import {
  createProposalAction,
  type ProposalActionState,
} from "@/app/(account)/messages/proposal-actions";

const initialState: ProposalActionState = { status: "IDLE", message: "" };

const CLIENT_KINDS: ProposalKind[] = ["DIRECT_BOOKING", "QUOTE_REQUEST", "CLIENT_OFFER"];

export function ProposalComposer({
  conversationId,
  currentUserIsClient,
  defaultKind,
  allowDirectBooking = false,
}: {
  conversationId: string;
  allowDirectBooking?: boolean;
  currentUserIsClient: boolean;
  defaultKind?: ProposalKind | undefined;
}) {
  const [state, action, pending] = useActionState(
    createProposalAction,
    initialState,
  );
  // Clave anti doble-tap: nace en cliente (sin mismatch de hidratacion),
  // se envia con el formulario y rota en cada submit para que la
  // siguiente propuesta use una clave nueva. Sin efectos: el boton se
  // deshabilita en pending y el DOM conserva la clave del submit.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof window === "undefined" ? "" : crypto.randomUUID(),
  );
  const roleDefaultKind: ProposalKind = currentUserIsClient
    ? "QUOTE_REQUEST"
    : "PROVIDER_QUOTE";
  const effectiveDefaultKind =
    defaultKind && proposalKinds.includes(defaultKind) &&
    (currentUserIsClient ? CLIENT_KINDS.includes(defaultKind) && (defaultKind !== "DIRECT_BOOKING" || allowDirectBooking) : defaultKind === "PROVIDER_QUOTE")
      ? defaultKind
      : roleDefaultKind;

  return (
    <details id="nueva-propuesta" className="border-ink/[0.08] bg-surface consumer-card relative scroll-mt-24 overflow-hidden rounded-2xl border shadow-[var(--consumer-shadow-card)]">
      <summary className="consumer-pressable inline-flex min-h-12 w-full cursor-pointer items-center gap-2.5 p-4 text-[15px] font-extrabold">
        <IllustratedBadge
          tone="gold"
          icon="tag"
          size="sm"
          label="Nueva propuesta"
        />
        {currentUserIsClient ? "Proponer un acuerdo" : "Enviar una cotización"}
      </summary>
      <span
        className="brand-gradient-surface pointer-events-none absolute inset-x-0 top-0 h-1.5"
        aria-hidden="true"
      />
      <div className="px-4 pb-4">
        {state.message ? (
          <p
            className={
              state.status === "ERROR"
                ? "bg-danger/[0.07] text-danger mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                : "bg-success/[0.07] text-success mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold"
            }
            role={state.status === "ERROR" ? "alert" : "status"}
            aria-live="polite"
          >
            {state.status === "SUCCESS" ? <SuccessCheck /> : null}
            {state.message}
          </p>
        ) : null}
        <form
          action={action}
          onSubmit={() => {
            setIdempotencyKey(crypto.randomUUID());
          }}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="conversationId" value={conversationId} />
          <input
            type="hidden"
            name="idempotencyKey"
            value={idempotencyKey}
            suppressHydrationWarning
          />
          <label className="text-ink text-sm font-bold">
            Tipo
            <select
              name="kind"
              defaultValue={effectiveDefaultKind}
              className="consumer-control text-ink mt-1.5 min-h-[52px] w-full px-3.5 text-base"
            >
              {currentUserIsClient ? (
                <>
                  {allowDirectBooking ? (
                    <option value="DIRECT_BOOKING">Reservar al precio publicado</option>
                  ) : null}
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
              className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {pending ? "Guardando…" : "Enviar propuesta"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
