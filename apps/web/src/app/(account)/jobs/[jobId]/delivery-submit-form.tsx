"use client";

import { useActionState } from "react";

import {
  submitDeliveryAction,
  type DeliverySubmitState,
} from "@/app/(account)/jobs/actions";

const initialState: DeliverySubmitState = { error: null };

export function DeliverySubmitForm({
  jobId,
  remote,
}: {
  jobId: string;
  remote: boolean;
}) {
  const [state, action, pending] = useActionState(
    submitDeliveryAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <label className="text-[13px] font-bold text-white/90">
        {remote ? "Resumen de la entrega digital" : "Resumen de lo realizado"}
        <textarea
          name="deliverySummary"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          placeholder={
            remote
              ? "Qué entregás y dónde verlo"
              : "Qué hiciste, qué quedó pendiente, qué revisó el cliente"
          }
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "entrega-error" : undefined}
          className="mt-1.5 w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white outline-none placeholder:font-normal placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/70"
        />
      </label>
      {remote ? (
        <label className="text-[13px] font-bold text-white/90">
          Enlace HTTPS de la entrega
          <input
            type="url"
            name="deliveryEvidenceUrl"
            required
            maxLength={2048}
            pattern="https://.*"
            placeholder="https://drive.google.com/..."
            className="mt-1.5 w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-medium text-white outline-none placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/70"
          />
          <span className="mt-1 block text-xs font-normal text-white/70">
            El cliente debe poder acceder al entregable. YALO no verifica
            automáticamente el contenido.
          </span>
        </label>
      ) : null}
      {state.error ? (
        <p
          id="entrega-error"
          role="alert"
          className="rounded-xl bg-white/10 px-3 py-2 text-[13px] leading-5 font-semibold text-white"
        >
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar para revisión"}
      </button>
    </form>
  );
}
