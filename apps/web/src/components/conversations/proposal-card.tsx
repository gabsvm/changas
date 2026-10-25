"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  canActorTransitionProposal,
  formatMinorUnits,
  minorUnitsToMajorInput,
  type ProposalKind,
} from "@changas/domain";

import {
  respondProposalAction,
  reviseProposalAction,
  type ProposalActionState,
} from "@/app/(account)/messages/proposal-actions";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import type { ProposalSummary } from "@/lib/proposals/server";

const initialState: ProposalActionState = { status: "IDLE", message: "" };

function RespondSubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

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
const statusTones: Record<
  ProposalSummary["proposal_status"],
  "neutral" | "success" | "warning" | "danger" | "brand" | "info"
> = {
  OPEN: "brand",
  ACCEPTED: "info",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
  EXPIRED: "neutral",
  AWAITING_PAYMENT: "warning",
  PAYMENT_FAILED: "danger",
  PAID: "success",
};

const expiresFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const scheduleFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function ProposalCard({
  proposal,
  conversationId,
  currentUserId,
  clientUserId,
  providerUserId,
  jobId,
}: {
  proposal: ProposalSummary;
  conversationId: string;
  currentUserId: string;
  clientUserId: string;
  providerUserId: string;
  jobId: string | null;
}) {
  const ownTerms = proposal.authored_by_user_id === currentUserId;
  const currentUserIsClient = currentUserId === clientUserId;
  const currentUserIsProvider = currentUserId === providerUserId;
  const [revisionState, revisionAction, revising] = useActionState(
    reviseProposalAction,
    initialState,
  );
  const [respondState, respondAction] = useActionState(
    respondProposalAction,
    initialState,
  );
  const router = useRouter();
  const [confirmingHire, setConfirmingHire] = useState(false);
  // Abre el composer de la conversación (#nueva-propuesta, mismo mecanismo
  // que el hilo): lo despliega, lo lleva a la vista y enfoca el alcance.
  function openNewQuoteComposer() {
    const composer = document.getElementById("nueva-propuesta");
    if (!(composer instanceof HTMLElement)) return;
    if (composer instanceof HTMLDetailsElement) composer.open = true;
    composer.scrollIntoView({ behavior: "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      composer
        .querySelector<HTMLInputElement | HTMLTextAreaElement>(
          'textarea[name="scope"], input[name="price"]',
        )
        ?.focus({ preventScroll: true });
    });
  }
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
    <article
      id={`propuesta-${proposal.proposal_id}`}
      className="border-ink/[0.08] bg-surface consumer-card scroll-mt-24 overflow-hidden rounded-2xl border shadow-[0_2px_4px_rgb(23_20_15/5%),0_16px_36px_-10px_rgb(23_20_15/20%)] dark:shadow-[0_16px_36px_-10px_rgb(0_0_0/70%)]"
    >
      <div
        className="relative flex items-center gap-3 overflow-hidden px-4 py-3"
        style={{
          backgroundImage: "var(--consumer-hero-gradient)",
        }}
      >
        <span
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
            backgroundSize: "10px 10px",
          }}
          aria-hidden="true"
        />
        <IllustratedBadge
          tone="orange"
          icon="tag"
          size="sm"
          label={kindLabels[proposal.proposal_kind]}
        />
        <p className="relative text-xs font-extrabold tracking-[0.06em] text-white uppercase drop-shadow-[0_1px_4px_rgb(0_0_0/30%)]">
          {kindLabels[proposal.proposal_kind]} · v{proposal.version_number}
        </p>
      </div>
      <div className="p-4 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold">
            {proposal.service_title}
          </h3>
          <StatusChip tone={statusTones[proposal.proposal_status]}>
            {statusLabels[proposal.proposal_status]}
          </StatusChip>
        </div>

        <p className="text-ink/70 mt-2.5 text-sm leading-6 whitespace-pre-wrap">
          {proposal.scope_text}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="border-ink/[0.08] bg-canvas rounded-xl border p-3">
            <dt className="text-ink/70 text-xs font-semibold">Precio total</dt>
            <dd className="mt-1 text-[15px] font-extrabold">
              {proposal.price_amount === null
                ? "A cotizar"
                : formatMinorUnits(
                    proposal.price_amount,
                    proposal.currency_code,
                  )}
            </dd>
          </div>
          <div className="border-ink/[0.08] bg-canvas rounded-xl border p-3">
            <dt className="text-ink/70 text-xs font-semibold">Modalidad</dt>
            <dd className="mt-1 text-[15px] font-extrabold">
              {proposal.modality === "REMOTE"
                ? "Remoto"
                : proposal.modality === "IN_PERSON"
                  ? "Presencial"
                  : "Ambas"}
            </dd>
          </div>
          {proposal.schedule_start_at ? (
            <div className="border-ink/[0.08] bg-canvas col-span-2 rounded-xl border p-3">
              <dt className="text-ink/70 text-xs font-semibold">
                Fecha acordada
              </dt>
              <dd className="mt-1 text-[15px] font-extrabold">
                {scheduleFormatter.format(new Date(proposal.schedule_start_at))}
                {proposal.schedule_end_at &&
                proposal.schedule_end_at !== proposal.schedule_start_at
                  ? ` → ${scheduleFormatter.format(new Date(proposal.schedule_end_at))}`
                  : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {proposal.price_amount !== null ? (
          <div
            className="border-ink/[0.08] bg-surface consumer-card relative mt-3 overflow-hidden rounded-xl border text-sm shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:bg-white/[0.05] dark:shadow-none"
            aria-label="Condiciones de contratación"
          >
            {/* Acento medido: franja navy (el gradiente identitario vive solo
               en --yalo-symbol-gradient y no tapiza tarjetas). */}
            <span
              className="bg-brand-primary pointer-events-none absolute inset-x-0 top-0 h-1.5 dark:bg-white/25"
              aria-hidden="true"
            />
            <div className="px-3.5 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <IllustratedBadge
                  tone="green"
                  icon="shield"
                  size="sm"
                  label="Condiciones"
                />
                <span className="text-[13px] font-extrabold">
                  Sin pago por adelantado
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-ink/70 text-[13px] font-semibold">
                  Total acordado
                </span>
                <span className="font-bold">
                  {formatMinorUnits(
                    proposal.price_amount,
                    proposal.currency_code,
                  )}
                </span>
              </div>
              <p className="text-ink/70 mt-2 text-xs leading-5">
                Aceptar contrata el trabajo sin pago por adelantado. Se liquida
                al finalizar.
              </p>
            </div>
          </div>
        ) : null}

        {proposal.expires_at ? (
          <p className="text-ink/70 mt-3 text-xs">
            Vigente hasta{" "}
            {expiresFormatter.format(new Date(proposal.expires_at))}
          </p>
        ) : null}
        {respondState.message ? (
          <p
            className={
              respondState.status === "ERROR"
                ? "bg-danger/[0.07] text-danger mt-4 rounded-xl px-3 py-2.5 text-sm font-semibold"
                : "bg-success/[0.07] text-success mt-4 rounded-xl px-3 py-2.5 text-sm font-semibold"
            }
            role={respondState.status === "ERROR" ? "alert" : "status"}
            aria-live="polite"
          >
            {respondState.message}
          </p>
        ) : null}
        {respondState.status === "SUCCESS" && respondState.jobId ? (
          <Link
            href={`/jobs/${respondState.jobId}`}
            className="consumer-pressable cta-ink mt-3 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
          >
            Ver seguimiento del servicio
          </Link>
        ) : null}

        {proposal.proposal_status === "OPEN" ? (
          <div className="mt-4 grid gap-2">
            {canAccept ? (
              confirmingHire ? (
                <form action={respondAction} className="grid gap-2">
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
                  <p className="border-ink/[0.08] bg-ink/[0.03] rounded-xl border px-3 py-2.5 text-sm leading-6 dark:bg-white/[0.04]">
                    Vas a contratar <strong>{proposal.service_title}</strong>{" "}
                    por{" "}
                    <strong>
                      {proposal.price_amount === null
                        ? "monto a cotizar"
                        : formatMinorUnits(
                            proposal.price_amount,
                            proposal.currency_code,
                          )}
                    </strong>
                    . Sin pago por adelantado.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingHire(false)}
                      className="consumer-pressable border-ink/[0.1] inline-flex min-h-12 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold dark:bg-white/[0.06]"
                    >
                      Volver
                    </button>
                    <RespondSubmitButton
                      label="Confirmar contratación"
                      pendingLabel="Confirmando…"
                      className="consumer-pressable cta-ink inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-extrabold disabled:opacity-50"
                    />
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingHire(true);
                    router.refresh();
                  }}
                  className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
                >
                  Contratar
                </button>
              )
            ) : null}
            {!ownTerms ? (
              <form action={respondAction} className="grid gap-2">
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
                <label className="text-xs font-semibold">
                  Motivo del rechazo (opcional)
                  <input
                    name="responseReason"
                    minLength={2}
                    maxLength={1000}
                    placeholder="Contale por qué no te sirve"
                    className="consumer-control mt-1 w-full px-3 py-2 text-sm font-normal"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <RespondSubmitButton
                    label="Rechazar"
                    pendingLabel="Rechazando…"
                    className="consumer-pressable border-ink/[0.1] inline-flex min-h-12 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50 dark:bg-white/[0.06]"
                  />
                  <button
                    type="button"
                    className="consumer-pressable text-ink/70 inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold"
                    onClick={() =>
                      document
                        .getElementById(`counter-${proposal.proposal_id}`)
                        ?.toggleAttribute("open")
                    }
                  >
                    Contraofertar
                  </button>
                </div>
              </form>
            ) : (
              <form action={respondAction} className="grid">
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
                <RespondSubmitButton
                  label="Retirar propuesta"
                  pendingLabel="Retirando…"
                  className="consumer-pressable border-ink/[0.1] inline-flex min-h-12 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50 dark:bg-white/[0.06]"
                />
              </form>
            )}
          </div>
        ) : null}

        {proposal.proposal_status === "REJECTED" ? (
          <div className="border-ink/[0.08] bg-ink/[0.03] mt-4 rounded-xl border px-3 py-2.5 text-sm leading-6 dark:bg-white/[0.04]">
            {proposal.response_reason ? (
              <p>
                <strong>Motivo del rechazo:</strong> {proposal.response_reason}
              </p>
            ) : (
              <p>Esta propuesta fue rechazada sin motivo.</p>
            )}
            <p className="text-ink/70 mt-1 text-[13px]">
              Podés ajustar los términos y enviar una nueva propuesta en esta
              misma conversación.
            </p>
            <button
              type="button"
              onClick={openNewQuoteComposer}
              className="consumer-pressable border-ink/[0.1] mt-2.5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold dark:bg-white/[0.06]"
            >
              Pedir nueva cotización
            </button>
          </div>
        ) : null}

        {proposal.proposal_status === "EXPIRED" ? (
          <div className="border-ink/[0.08] bg-ink/[0.03] mt-4 rounded-xl border px-3 py-2.5 text-sm leading-6 dark:bg-white/[0.04]">
            <p>Esta propuesta venció y ya no se puede responder.</p>
            <p className="text-ink/70 mt-1 text-[13px]">
              Pedí una nueva cotización para retomar la conversación con
              términos actualizados.
            </p>
            <button
              type="button"
              onClick={openNewQuoteComposer}
              className="consumer-pressable border-ink/[0.1] mt-2.5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold dark:bg-white/[0.06]"
            >
              Pedir nueva cotización
            </button>
          </div>
        ) : null}

        {proposal.proposal_status === "ACCEPTED" && jobId ? (
          <Link
            href={`/jobs/${jobId}`}
            className="consumer-pressable cta-ink mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
          >
            Ver seguimiento del servicio
          </Link>
        ) : null}

        {canCounter ? (
          <details
            id={`counter-${proposal.proposal_id}`}
            className="border-ink/[0.08] mt-4 border-t pt-3"
          >
            <summary className="consumer-pressable text-brand-primary inline-flex min-h-11 cursor-pointer items-center text-sm font-bold dark:text-white">
              {counterKind === "PROVIDER_QUOTE"
                ? "Enviar cotización"
                : "Responder con contraoferta"}
            </summary>
            <form action={revisionAction} className="mt-3 space-y-2">
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
                className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold disabled:opacity-50"
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
      </div>
    </article>
  );
}
