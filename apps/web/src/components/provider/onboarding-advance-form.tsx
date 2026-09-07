"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

type ProviderAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function OnboardingAdvanceForm({
  action,
  nextStep,
  nextHref,
  label = "Guardar progreso y continuar",
}: {
  action: ProviderAction;
  nextStep: number;
  nextHref: string;
  label?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  useEffect(() => {
    if (state.success) {
      router.push(nextHref);
      router.refresh();
    }
  }, [nextHref, router, state.success]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="step" value={nextStep} />
      <button
        className="button-primary w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        type="submit"
        disabled={pending}
      >
        {pending ? "Guardando…" : label}
      </button>
      {state.error ? (
        <p
          className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="bg-success/10 text-success rounded-2xl px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {state.success} Continuando…
        </p>
      ) : null}
    </form>
  );
}
