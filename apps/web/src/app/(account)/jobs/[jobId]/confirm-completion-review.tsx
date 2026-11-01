"use client";

import { useState } from "react";

import { formatMinorUnits } from "@changas/domain";

import { transitionJobAction } from "@/app/(account)/jobs/actions";
import { BottomSheet } from "@/components/ui/marketplace/bottom-sheet";
import { CorrectionForm } from "@/app/(account)/jobs/[jobId]/correction-form";

type ConfirmCompletionReviewProps = {
  jobId: string;
  providerName: string;
  conversationId: string;
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
  providerName,
  conversationId,
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold"
      >
        Revisar y confirmar
      </button>
      <BottomSheet
        open={open}
        title="Revisá antes de confirmar"
        onClose={() => setOpen(false)}
      >
        <p className="text-ink/70 mb-3 text-sm">Prestador: {providerName}</p>
        <dl className="text-ink space-y-1 text-sm leading-6">
          <div className="flex justify-between gap-3">
            <dt className="text-ink/70">Precio base</dt>
            <dd className="font-bold">
              {formatMinorUnits(baseMinor, currencyCode)}
            </dd>
          </div>
          {extrasMinor > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink/70">Adicionales pendientes</dt>
              <dd className="font-bold">
                {formatMinorUnits(extrasMinor, currencyCode)}
              </dd>
            </div>
          ) : null}
          <div className="border-ink/20 flex justify-between gap-3 border-t pt-1">
            <dt className="font-extrabold">Total pendiente</dt>
            <dd className="font-extrabold">
              {formatMinorUnits(totalMinor, currencyCode)}
            </dd>
          </div>
        </dl>
        <p className="text-ink/70 mt-2 text-xs leading-5">
          Confirmar no cobra nada todavía: el pago se hace después, por
          separado.
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
        <a
          href={`/messages/${conversationId}`}
          className="text-ink mt-3 inline-flex min-h-11 items-center text-sm font-bold underline"
        >
          Algo salió mal · Volver al chat
        </a>
      </BottomSheet>
      <div className="mt-2">
        <CorrectionForm jobId={jobId} />
      </div>
    </>
  );
}
