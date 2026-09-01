"use client";

import { useActionState } from "react";

import {
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
    proposal.proposal_status === "OPEN" &&
    !ownTerms &&
    priced &&
    ((currentUserIsClient && proposal.authored_by_user_id === providerUserId) ||
      (currentUserIsProvider && proposal.authored_by_user_id === clientUserId));
  const canCounter = proposal.proposal_status === "OPEN" && !ownTerms;
  const counterKind: ProposalKind =
    proposal.proposal_kind === "QUOTE_REQUEST" && currentUserIsProvider
      ? "PROVIDER_QUOTE"
      : "COUNTEROFFER";

  return (
    <article className="border-ink/10 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ink/50 text-[11px] font-bold tracking-[0.08em] uppercase">
            {kindLabels[proposal.proposal_kind]} · v{proposal.version_number}
          </p>
          <h3 className="mt-1 font-semibold">{proposal.service_title}</h3>
        </div>
        <span className="bg-moss/10 text-moss rounded-full px-2.5 py-1 text-[11px] font-bold">
          {statusLabels[proposal.proposal_status]}
        </span>
      </div>

      <p className="text-ink/70 mt-3 whitespace-pre-wrap text-sm leading-6">
        {proposal.scope_text}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-canvas rounded-xl p-3">
          <dt className="text-ink/45">Precio</dt>
          <dd className="mt-1 font-bold">
            {proposal.price_amount === null
              ? "A cotizar"
              : formatMinorUnits(
                  proposal.price_amount,
                  proposal.currency_code,
                )}
          </dd>
        </div>
        <div className="bg-canvas rounded-xl p-3">
          <dt className="text-ink/45">Modalidad</dt>
          <dd className="mt-1 font-bold">
            {proposal.modality === "REMOTE"
              ? "Remoto"
              : proposal.modality === "IN_PERSON"
                ? "Presencial"
                : "Presencial o remoto"}
          </dd>
        </div>
      </dl>

      {proposal.expires_at ? (
        <p className="text-ink/45 mt-3 text-[11px]">
          Vigente hasta {expiresFormatter.format(new Date(proposal.expires_at))}
        </p>
      ) : null}

      {proposal.proposal_status === "OPEN" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canAccept ? (
            <form action={respondProposalAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <input type="hidden" name="proposalId" value={proposal.proposal_id} />
              <input type="hidden" name="action" value="ACCEPT" />
              <button className="bg-ink rounded-full px-4 py-2 text-xs font-bold text-white">
                Aceptar
              </button>
            </form>
          ) : null}
          {!ownTerms ? (
            <form action={respondProposalAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <input type="hidden" name="proposalId" value={proposal.proposal_id} />
              <input type="hidden" name="action" value="REJECT" />
              <button className="border-ink/10 rounded-full border px-4 py-2 text-xs font-bold">
                Rechazar
              </button>
            </form>
          ) : (
            <form action={respondProposalAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <input type="hidden" name="proposalId" value={proposal.proposal_id} />
              <input type="hidden" name="action" value="WITHDRAW" />
              <button className="border-ink/10 rounded-full border px-4 py-2 text-xs font-bold">
                Retirar
              </button>
            </form>
          )}
        </div>
      ) : null}

      {canCounter ? (
        <details className="border-ink/10 mt-4 border-t pt-3">
          <summary className="cursor-pointer text-xs font-bold">
            {counterKind === "PROVIDER_QUOTE"
              ? "Enviar cotización"
              : "Responder con contraoferta"}
          </summary>
          <form action={revisionAction} className="mt-3 space-y-2">
            <input type="hidden" name="conversationId" value={conversationId} />
            <input type="hidden" name="proposalId" value={proposal.proposal_id} />
            <input type="hidden" name="kind" value={counterKind} />
            <textarea
              name="scope"
              defaultValue={proposal.scope_text}
              required
              maxLength={4000}
              rows={3}
              className="border-ink/10 w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm"
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
              className="border-ink/10 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={revising}
              className="bg-ink rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {revising ? "Enviando…" : "Enviar respuesta"}
            </button>
            {revisionState.message ? (
              <p className="text-ink/55 text-xs">{revisionState.message}</p>
            ) : null}
          </form>
        </details>
      ) : null}

      {(proposal.proposal_status === "AWAITING_PAYMENT" ||
        proposal.proposal_status === "PAYMENT_FAILED") &&
      currentUserIsClient &&
      allowFakePayments ? (
        <div className="border-moss/20 bg-moss/5 mt-4 rounded-xl border p-3">
          <p className="text-moss text-xs font-bold">
            Pago simulado · solo desarrollo
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["SUCCESS", "PENDING", "FAILURE"] as const).map((outcome) => (
              <form key={outcome} action={fakePaymentAction}>
                <input type="hidden" name="conversationId" value={conversationId} />
                <input type="hidden" name="proposalId" value={proposal.proposal_id} />
                <input type="hidden" name="outcome" value={outcome} />
                <button className="border-moss/20 rounded-full border bg-white px-3 py-1.5 text-[11px] font-bold">
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
