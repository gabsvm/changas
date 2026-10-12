"use client";

import { useActionState } from "react";

import {
  requestCompletionAction,
  type CompletionCodeState,
} from "@/app/(account)/jobs/actions";

const initialState: CompletionCodeState = { error: null };

export function ConfirmationCodeForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(
    requestCompletionAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <label className="text-[13px] font-bold text-white/90">
        Código del cliente
        <input
          name="confirmationCode"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          pattern="[0-9]{4}"
          placeholder="4 dígitos"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "codigo-error" : undefined}
          className="mt-1.5 h-[52px] w-full rounded-xl border border-white/25 bg-white/10 px-4 text-center text-lg font-extrabold tracking-[0.3em] text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-white/50"
        />
      </label>
      {state.error ? (
        <p
          id="codigo-error"
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
        {pending ? "Verificando…" : "Solicitar finalización"}
      </button>
    </form>
  );
}
