"use client";

import { useState } from "react";

import { formatMinorUnits } from "@changas/domain";

import { transitionJobAction } from "@/app/(account)/jobs/actions";
import { CorrectionForm } from "@/app/(account)/jobs/[jobId]/correction-form";

type ConfirmCompletionReviewProps = {
  jobId: string;
  baseMinor: number;
  extrasMinor: number;
  totalMinor: number;
  currencyCode: "ARS";
  compact?: boolean;
};

/**
 * Interstitial de revisión (P1-07): el primer clic solo abre el detalle
 * (useState local, sin commit SQL). El commit real a COMPLETED ocurre
 * únicamente con "Confirmar trabajo por $X". No es un checkout: confirmar
 * no cobra nada todavía, el pago va por separado.
 */
export function ConfirmCompletionReview({
  jobId,
  baseMinor,
  extrasMinor,
  totalMinor,
  currencyCode,
  compact = false,
}: ConfirmCompletionReviewProps) {
  const [open, setOpen] = useState(false);

  if (compact && !open) {
    return (
      <a
        href="#proxima-accion"
        className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
      >
        Revisar y confirmar
      </a>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={`confirm-review-${jobId}`}
        className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
      >
        Revisar y confirmar
      </button>
    );
  }

  return (
    <div
      id={`confirm-review-${jobId}`}
      className="rounded-xl border border-white/25 bg-white/10 p-4"
    >
      <dl className="space-y-1 text-sm leading-6 text-white">
        <div className="flex justify-between gap-3">
          <dt className="text-white/75">Precio base</dt>
          <dd className="font-bold">
            {formatMinorUnits(baseMinor, currencyCode)}
          </dd>
        </div>
        {extrasMinor > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-white/75">Adicionales pendientes</dt>
            <dd className="font-bold">
              {formatMinorUnits(extrasMinor, currencyCode)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-white/20 pt-1">
          <dt className="font-extrabold">Total pendiente</dt>
          <dd className="font-extrabold">
            {formatMinorUnits(totalMinor, currencyCode)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-5 text-white/75">
        Confirmar no cobra nada todavía: el pago se hace después, por separado.
      </p>
      <form action={transitionJobAction} className="mt-3">
        <input type="hidden" name="jobId" value={jobId} />
        <input
          type="hidden"
          name="expectedStatus"
          value="COMPLETION_REQUESTED"
        />
        <input type="hidden" name="requestedStatus" value="COMPLETED" />
        <button className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold">
          Confirmar trabajo por {formatMinorUnits(totalMinor, currencyCode)}
        </button>
      </form>
      <div className="mt-2 grid gap-2">
        <CorrectionForm jobId={jobId} />
        <a
          href="#ayuda"
          className="consumer-pressable inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/25 px-4 text-sm font-bold text-white"
        >
          Reportar problema
        </a>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 text-sm font-semibold text-white/75 underline"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
