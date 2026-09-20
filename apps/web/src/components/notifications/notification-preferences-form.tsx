"use client";

import { useActionState, useRef } from "react";

import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { Switch } from "@/components/ui/marketplace/switch";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import type { NotificationPreferences } from "@/lib/notifications/server";
import { NOTIFICATION_PREFERENCE_GROUPS } from "@/lib/ui/account-settings";

type PreferencesAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function NotificationPreferencesForm({
  action,
  initialValues,
}: {
  action: PreferencesAction;
  initialValues: NotificationPreferences;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  function persistChange() {
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <form ref={formRef} action={formAction}>
      {pending ? (
        <p
          className="bg-brand-orange/[0.08] text-terracotta px-4 py-2.5 text-sm font-semibold"
          role="status"
          aria-live="polite"
        >
          Guardando cambio…
        </p>
      ) : state.error ? (
        <p
          className="bg-danger/[0.07] text-danger px-4 py-2.5 text-sm font-semibold"
          role="alert"
        >
          {state.error}
        </p>
      ) : state.success ? (
        <p
          className="bg-success/[0.07] text-success px-4 py-2.5 text-sm font-semibold"
          role="status"
          aria-live="polite"
        >
          Cambios guardados
        </p>
      ) : null}

      {NOTIFICATION_PREFERENCE_GROUPS.map((group) => (
        <fieldset key={group.id} className="px-0">
          <legend className="text-ink/48 px-0 pt-3 text-[0.68rem] font-bold tracking-[0.1em] uppercase">
            {group.title}
          </legend>
          <div className="divide-ink/[0.07] divide-y">
            {group.toggles.map((toggle) => (
              <SettingsRow
                key={toggle.name}
                title={toggle.title}
                description={toggle.description}
                trailing={
                  <Switch
                    name={toggle.name}
                    defaultChecked={initialValues[toggle.name]}
                    onChange={persistChange}
                    disabled={pending}
                    ariaLabel={toggle.title}
                  />
                }
              />
            ))}
          </div>
        </fieldset>
      ))}

      <button
        type="submit"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        Guardar preferencias
      </button>
    </form>
  );
}
