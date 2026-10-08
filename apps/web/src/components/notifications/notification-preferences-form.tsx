"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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

  const [savedVisible, setSavedVisible] = useState(false);

  useEffect(() => {
    if (!state.success) return;
    const show = window.setTimeout(() => setSavedVisible(true), 0);
    const hide = window.setTimeout(() => setSavedVisible(false), 2500);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [state]);

  function persistChange() {
    if (pending) return;
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <form ref={formRef} action={formAction}>
      {state.error ? (
        <p
          className="bg-danger/[0.07] text-danger px-4 py-2.5 text-sm font-semibold"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {/* A fixed toast avoids shifting the list when a change is saved. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--mobile-bottom-nav-height)+0.75rem)] z-40 flex justify-center sm:bottom-6"
      >
        {pending || savedVisible ? (
          <p className="bg-ink pop-in rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {pending ? "Guardando cambio…" : "Cambios guardados"}
          </p>
        ) : null}
      </div>

      {NOTIFICATION_PREFERENCE_GROUPS.map((group) => (
        <fieldset key={group.id} className="px-0">
          <legend className="text-ink/70 px-0 pt-3 text-[11px] font-bold tracking-[0.1em] uppercase">
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
