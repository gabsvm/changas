"use client";

import { useActionState } from "react";

import {
  canActorTransitionProposal,
  formatMinorUnits,
  minorUnitsToMajorInput,
  type ProposalKind,
} from "@changas/domain";

import {
  fakePaymentAction,
  respondProposalAction,
  reviseProposalAction,
  type ProposalActionState,
} from "@/app/(account)/messages/proposal-actions";
import type { ProposalSummary } from "@/lib/proposals/server";

const initialState: ProposalActionState = { status: "IDLE", message: "" };

const kindLabels: Record<ProposalKind, string> = {
  DIRECT_BOOKING: "Reserva directa",
  QUOTE_REQUEST: "Solicitud de cotización",
  PROVIDER_QUOTE: "Cotización",
  CLIENT_OFFER: "Oferta",
  COUNTEROFFER: "Contraoferta",
};

const statusLabels: Record<ProposalSummary["proposal_status"], string> = {
  OPEN: "Abierta",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  WITHDRAWN: "Retirada",
  EXPIRED: "Vencida",
  AWAITING_PAYMENT: "Esperando pago",
  PAYMENT_FAILED: "Pago fallido",
  PAID: "Pagada · trabajo confirmado",
};

const expiresFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function ProposalCard({
  proposal,
  conversationId,
  currentUserId,
  clientUserId,
  providerUserId,
  allowFakePayments,
}: {
  proposal: ProposalSummary;
  conversationId: string;
  currentUserId: string;
  clientUserId: string;
  providerUserId: string;
  allowFakePayments: boolean;
}) {
  const ownTerms = proposal.authored_by_user_id === currentUserId;
  const currentUserIsClient = currentUserId === clientUserId;
  const currentUserIsProvider = currentUserId === providerUserId;
  const [revisionState, revisionAction, revising] = useActionState(
    reviseProposalAction,
    initialState,
  );
  const priced = proposal.price_amount !== null;
  const canAccept =
    priced &&
    canActorTransitionProposal({
      actorRole: currentUserIsClient ? "CLIENT" : "PROVIDER",
      actorIsAuthor: ownTerms,
      from: proposal.proposal_status,
      to: "ACCEPTED",
    });
  const canCounter = proposal.proposal_status === "OPEN" && !ownTerms;
  const counterKind: ProposalKind =
    proposal.proposal_kind === "QUOTE_REQUEST" && currentUserIsProvider
      ? "PROVIDER_QUOTE"
      : "COUNTEROFFER";

  return (
    <article className="border-brand-orange/20 bg-surface rounded-2xl border p-4 shadow-[var(--consumer-shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink/60 text-xs font-bold tracking-[0.06em] uppercase">
            {kindLabels[proposal.proposal_kind]} · v{proposal.version_number}
          </p>
          <h3 className="mt-1 truncate text-[15px] font-extrabold">
            {proposal.service_title}
          </h3>
        </div>
        <span className="bg-moss/10 text-moss shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">
          {statusLabels[proposal.proposal_status]}
        </span>
      </div>

      <p className="text-ink/70 mt-2.5 text-sm leading-6 whitespace-pre-wrap">
        {proposal.scope_text}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="bg-canvas rounded-xl p-3">
          <dt className="text-ink/60 text-xs font-semibold">Precio total</dt>
          <dd className="mt-1 text-[15px] font-extrabold">
            {proposal.price_amount === null
              ? "A cotizar"
              : formatMinorUnits(proposal.price_amount, proposal.currency_code)}
          </dd>
        </div>
        <div className="bg-canvas rounded-xl p-3">
          <dt className="text-ink/60 text-xs font-semibold">Modalidad</dt>
          <dd className="mt-1 text-[15px] font-extrabold">
            {proposal.modality === "REMOTE"
              ? "Remoto"
              : proposal.modality === "IN_PERSON"
                ? "Presencial"
                : "Ambas"}
          </dd>
        </div>
      </dl>

      {proposal.expires_at ? (
        <p className="text-ink/60 mt-3 text-xs">
          Vigente hasta {expiresFormatter.format(new Date(proposal.expires_at))}
        </p>
      ) : null}

      {proposal.proposal_status === "OPEN" ? (
        <div className="mt-4 grid gap-2">
          {canAccept ? (
            <form action={respondProposalAction} className="grid">
              <input
                type="hidden"
                name="conversationId"
                value={conversationId}
              />
              <input
                type="hidden"
                name="proposalId"
                value={proposal.proposal_id}
              />
              <input type="hidden" name="action" value="ACCEPT" />
              <button className="consumer-pressable bg-ink inline-flex min-h-[52px] items-center justify-center rounded-xl px-4 text-[15px] font-extrabold text-white">
                Aceptar propuesta
              </button>
            </form>
          ) : null}
          {!ownTerms ? (
            <form
              action={respondProposalAction}
              className="grid grid-cols-2 gap-2"
            >
              <input
                type="hidden"
                name="conversationId"
                value={conversationId}
              />
              <input
                type="hidden"
                name="proposalId"
                value={proposal.proposal_id}
              />
              <input type="hidden" name="action" value="REJECT" />
              <button className="consumer-pressable border-ink/[0.1] inline-flex min-h-12 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold">
                Rechazar
              </button>
              <button
                type="button"
                className="consumer-pressable text-ink/60 inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold"
                onClick={() =>
                  document
                    .getElementById(`counter-${proposal.proposal_id}`)
                    ?.toggleAttribute("open")
                }
              >
                Contraofertar
              </button>
            </form>
          ) : (
            <form action={respondProposalAction} className="grid">
              <input
                type="hidden"
                name="conversationId"
                value={conversationId}
              />
              <input
                type="hidden"
                name="proposalId"
                value={proposal.proposal_id}
              />
              <input type="hidden" name="action" value="WITHDRAW" />
              <button className="consumer-pressable border-ink/[0.1] inline-flex min-h-12 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold">
                Retirar propuesta
              </button>
            </form>
          )}
        </div>
      ) : null}

      {canCounter ? (
        <details
          id={`counter-${proposal.proposal_id}`}
          className="border-ink/[0.08] mt-4 border-t pt-3"
        >
          <summary className="consumer-pressable text-terracotta inline-flex min-h-11 cursor-pointer items-center text-sm font-bold">
            {counterKind === "PROVIDER_QUOTE"
              ? "Enviar cotización"
              : "Responder con contraoferta"}
          </summary>
          <form action={revisionAction} className="mt-3 space-y-2">
            <input type="hidden" name="conversationId" value={conversationId} />
            <input
              type="hidden"
              name="proposalId"
              value={proposal.proposal_id}
            />
            <input type="hidden" name="kind" value={counterKind} />
            <textarea
              name="scope"
              defaultValue={proposal.scope_text}
              required
              maxLength={4000}
              rows={3}
              className="consumer-control w-full resize-none px-3 py-2 text-sm"
            />
            <input
              name="price"
              inputMode="decimal"
              required
              defaultValue={minorUnitsToMajorInput(
                proposal.price_amount,
                proposal.currency_code,
              )}
              placeholder="Precio en ARS"
              className="consumer-control w-full px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={revising}
              className="consumer-pressable bg-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
            >
              {revising ? "Enviando…" : "Enviar respuesta"}
            </button>
            {revisionState.message ? (
              <p
                className={
                  revisionState.status === "ERROR"
                    ? "bg-danger/[0.07] text-danger mt-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
                    : "bg-success/[0.07] text-success mt-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
                }
                role={revisionState.status === "ERROR" ? "alert" : "status"}
                aria-live="polite"
              >
                {revisionState.message}
              </p>
            ) : null}
          </form>
        </details>
      ) : null}

      {(proposal.proposal_status === "AWAITING_PAYMENT" ||
        proposal.proposal_status === "PAYMENT_FAILED") &&
      currentUserIsClient &&
      allowFakePayments ? (
        <div className="border-moss/20 bg-moss/5 mt-4 rounded-lg border p-3">
          <p className="text-moss text-xs font-bold">
            Pago simulado · solo desarrollo
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["SUCCESS", "PENDING", "FAILURE"] as const).map((outcome) => (
              <form key={outcome} action={fakePaymentAction}>
                <input
                  type="hidden"
                  name="conversationId"
                  value={conversationId}
                />
                <input
                  type="hidden"
                  name="proposalId"
                  value={proposal.proposal_id}
                />
                <input type="hidden" name="outcome" value={outcome} />
                <button className="consumer-pressable border-moss/20 inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-[13px] font-bold">
                  {outcome === "SUCCESS"
                    ? "Simular aprobado"
                    : outcome === "PENDING"
                      ? "Simular pendiente"
                      : "Simular fallo"}
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
