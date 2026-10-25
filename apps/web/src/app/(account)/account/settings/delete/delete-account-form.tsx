"use client";

import { useActionState, useId } from "react";

import { ActionButton } from "@/components/ui/marketplace/action-button";
import type { AuthActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

export function DeleteAccountForm({
  action,
  hasPasswordProvider,
}: {
  action: (
    previousState: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  hasPasswordProvider: boolean;
}) {
  const passwordId = useId();
  const confirmationId = useId();
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const input =
    "border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-3 text-base dark:border-white/15 dark:bg-white/5";

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {hasPasswordProvider ? (
        <div>
          <label htmlFor={passwordId} className="block text-sm font-semibold">
            Contraseña
          </label>
          <input
            id={passwordId}
            className={input}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      ) : (
        <p className="text-ink/70 text-sm leading-6">
          Confirmá con tu sesión de Google: escribí ELIMINAR
        </p>
      )}
      <div>
        <label htmlFor={confirmationId} className="block text-sm font-semibold">
          Escribí ELIMINAR para confirmar
        </label>
        <input
          id={confirmationId}
          className={input}
          name="confirmation"
          autoComplete="off"
          required
        />
      </div>
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
