"use client";

import { useActionState } from "react";

import { ActionButton } from "@/components/ui/marketplace/action-button";
import type { AuthActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

export function DeleteAccountForm({
  action,
}: {
  action: (
    previousState: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const input =
    "border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-3 text-base";

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">
        Contraseña
        <input
          className={input}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Escribí ELIMINAR para confirmar
        <input
          className={input}
          name="confirmation"
          autoComplete="off"
          required
        />
      </label>
      {state.error ? (
        <p className="text-danger text-sm font-semibold" role="alert">
          {state.error}
        </p>
      ) : null}
      <ActionButton
        tone="danger"
        type="submit"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Eliminando…" : "Eliminar mi cuenta"}
      </ActionButton>
    </form>
  );
}
