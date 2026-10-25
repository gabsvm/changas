"use client";

import { useActionState } from "react";

import {
  respondExternalPaymentAction,
  type ExternalPaymentResponseState,
} from "@/app/(account)/jobs/actions";

const initialState: ExternalPaymentResponseState = { error: null };

export function ExternalPaymentResponseForm({
  jobId,
  declarationId,
  decision,
  isClient,
}: {
  jobId: string;
  declarationId: string;
  decision: "accept" | "contest";
  isClient: boolean;
}) {
  const [state, action, pending] = useActionState(
    respondExternalPaymentAction,
    initialState,
  );
  const isContest = decision === "contest";

  return (
    <form action={action} className={isContest ? "grid gap-2 p-3 pt-0" : ""}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="declarationId" value={declarationId} />
      <input type="hidden" name="decision" value={decision} />
      {isContest ? (
        <label className="text-xs font-bold">
          Motivo del desacuerdo
          <textarea
            name="reason"
            required
            minLength={1}
            maxLength={1000}
            rows={2}
            placeholder="Contá qué pasó"
            aria-invalid={state.error ? true : undefined}
            className="border-ink/15 bg-surface text-ink mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal"
          />
        </label>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="border-danger/25 bg-danger/[0.07] text-danger rounded-xl border px-3 py-2 text-[13px] leading-5 font-semibold"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={
          isContest
            ? "consumer-pressable border-ink/30 inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-bold disabled:opacity-50"
            : "consumer-pressable cta-ink inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-extrabold disabled:opacity-50"
        }
      >
        {pending
          ? "Guardando…"
          : isContest
            ? "Marcar desacuerdo"
            : isClient
              ? "Confirmar que lo pagué"
              : "Confirmar que lo recibí"}
      </button>
    </form>
  );
}
