"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";
import type { NotificationPreferences } from "@/lib/notifications/server";

type PreferencesAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

function PreferenceToggle({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="border-ink/10 flex items-start justify-between gap-4 rounded-xl border bg-white/60 p-4">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-ink/60 mt-1 block text-sm leading-5">
          {description}
        </span>
      </span>
      <input
        className="mt-1 size-5 accent-[#31594f]"
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
      />
    </label>
  );
}

export function NotificationPreferencesForm({
  action,
  initialValues,
}: {
  action: PreferencesAction;
  initialValues: NotificationPreferences;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="border-ink/10 rounded-xl border bg-white/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold">En la app</span>
            <span className="text-ink/60 mt-1 block text-sm leading-5">
              Las alertas importantes de seguridad, cuenta y actividad siempre
              quedan disponibles dentro de Changas.
            </span>
          </span>
          <input
            className="mt-1 size-5 accent-[#31594f]"
            type="checkbox"
            checked
            disabled
            readOnly
            aria-label="Notificaciones dentro de la app activadas"
          />
        </div>
      </div>

      <PreferenceToggle
        name="emailImportantEnabled"
        title="Correos importantes"
        description="Recibí por email cambios importantes de trabajos, pagos y cuenta cuando corresponda."
        defaultChecked={initialValues.emailImportantEnabled}
      />
      <PreferenceToggle
        name="jobRemindersEnabled"
        title="Recordatorios de trabajos"
        description="Avisos para trabajos programados próximos."
        defaultChecked={initialValues.jobRemindersEnabled}
      />
      <PreferenceToggle
        name="proposalAlertsEnabled"
        title="Propuestas"
        description="Alertas cuando una propuesta requiere tu atención."
        defaultChecked={initialValues.proposalAlertsEnabled}
      />
      <PreferenceToggle
        name="verificationAlertsEnabled"
        title="Verificación"
        description="Cambios relevantes en verificaciones de la cuenta o del perfil."
        defaultChecked={initialValues.verificationAlertsEnabled}
      />
      <PreferenceToggle
        name="promotionalEnabled"
        title="Promociones"
        description="Novedades comerciales opcionales. Desactivarlas no silencia alertas importantes."
        defaultChecked={initialValues.promotionalEnabled}
      />

      {state.error ? (
        <p
          className="bg-terracotta/10 text-terracotta rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="bg-moss/10 text-moss rounded-xl px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {state.success}
        </p>
      ) : null}

      <button
        className="button-primary disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Guardando…" : "Guardar preferencias"}
      </button>
    </form>
  );
}
