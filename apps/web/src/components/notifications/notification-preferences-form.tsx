"use client";

import { useActionState, useRef } from "react";

import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { Switch } from "@/components/ui/marketplace/switch";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import type { NotificationPreferences } from "@/lib/notifications/server";

type PreferencesAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type ToggleConfig = {
  name: keyof Pick<
    NotificationPreferences,
    | "emailImportantEnabled"
    | "jobRemindersEnabled"
    | "proposalAlertsEnabled"
    | "verificationAlertsEnabled"
    | "promotionalEnabled"
  >;
  title: string;
  description: string;
};

const toggles: ToggleConfig[] = [
  {
    name: "emailImportantEnabled",
    title: "Correos importantes",
    description: "Cambios de trabajos, pagos y cuenta.",
  },
  {
    name: "jobRemindersEnabled",
    title: "Recordatorios de trabajos",
    description: "Avisos para trabajos programados próximos.",
  },
  {
    name: "proposalAlertsEnabled",
    title: "Propuestas",
    description: "Cuando una propuesta requiere tu atención.",
  },
  {
    name: "verificationAlertsEnabled",
    title: "Verificación",
    description: "Cambios relevantes de cuenta o perfil.",
  },
  {
    name: "promotionalEnabled",
    title: "Promociones",
    description: "Novedades comerciales opcionales.",
  },
];

export function NotificationPreferencesForm({
  action,
  initialValues,
}: {
  action: PreferencesAction;
  initialValues: NotificationPreferences;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  function persistChange() {
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <form ref={formRef} action={formAction} className="divide-y divide-ink/[0.07]">
      {toggles.map((toggle) => (
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
              ariaLabel={`${toggle.title}: ${initialValues[toggle.name] ? "activado" : "desactivado"}`}
            />
          }
        />
      ))}

      <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
        Guardar preferencias
      </button>

      {pending ? (
        <p className="text-ink/45 py-3 text-xs" role="status" aria-live="polite">
          Guardando cambio…
        </p>
      ) : state.error ? (
        <p className="text-danger py-3 text-xs" role="alert">
          {state.error}
        </p>
      ) : state.success ? (
        <p className="text-success py-3 text-xs" role="status" aria-live="polite">
          Cambios guardados
        </p>
      ) : null}
    </form>
  );
}
