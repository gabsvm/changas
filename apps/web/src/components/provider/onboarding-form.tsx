"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

type ProviderAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const steps = ["Datos básicos", "Identidad privada", "Documentos", "Revisión"];

export function OnboardingForm({
  action,
  currentStep,
  editable,
}: {
  action: ProviderAction;
  currentStep: number;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const nextStep = Math.min(currentStep + 1, 4);

  return (
    <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        Progreso guardado
      </p>
      <h2 className="font-display mt-2 text-2xl font-semibold">
        Onboarding en cuatro pasos
      </h2>
      <ol
        className="mt-6 grid gap-3 sm:grid-cols-4"
        aria-label="Progreso del onboarding"
      >
        {steps.map((step, index) => {
          const number = index + 1;
          const complete = number < currentStep;
          const current = number === currentStep;
          return (
            <li
              className={`rounded-xl border px-3 py-3 text-sm ${current ? "border-moss bg-moss/10" : "border-ink/10 bg-white/50"}`}
              key={step}
            >
              <span className="text-ink/50 text-xs font-semibold">
                0{number}
              </span>
              <span className="mt-1 block font-semibold">{step}</span>
              <span className="text-ink/55 mt-1 block text-xs">
                {complete ? "Listo" : current ? "En curso" : "Pendiente"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-ink/65 mt-6 text-sm leading-6">
        Podés salir y volver más tarde. El avance se guarda en tu perfil privado
        y no habilita servicios automáticamente.
      </p>
      {editable ? (
        <form
          action={formAction}
          className="mt-6 flex flex-wrap items-center gap-4"
        >
          <input type="hidden" name="step" value={nextStep} />
          <button
            className="button-primary disabled:cursor-wait disabled:opacity-60"
            type="submit"
            disabled={pending}
          >
            {pending
              ? "Guardando…"
              : currentStep === 4
                ? "Mantener este paso"
                : `Guardar y seguir al paso ${nextStep}`}
          </button>
        </form>
      ) : null}
      {state.error ? (
        <p
          className="bg-terracotta/10 text-terracotta mt-4 rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="bg-moss/10 text-moss mt-4 rounded-xl px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {state.success}
        </p>
      ) : null}
    </section>
  );
}

export function IdentityDocumentForm({
  action,
  editable,
}: {
  action: ProviderAction;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        Privado
      </p>
      <h2 className="font-display mt-2 text-2xl font-semibold">
        Documentos de identidad
      </h2>
      <p className="text-ink/60 mt-2 text-sm leading-6">
        Aceptamos JPG, PNG o PDF de hasta 10 MiB. Los archivos quedan en un
        bucket privado y no mostramos sus rutas.
      </p>
      <form
        action={formAction}
        encType="multipart/form-data"
        className="mt-6 space-y-5"
      >
        <label className="block text-sm font-semibold">
          Tipo de documento
          <select
            className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2"
            name="documentType"
            defaultValue="DNI_FRONT"
            disabled={!editable}
          >
            <option value="DNI_FRONT">DNI frente</option>
            <option value="DNI_BACK">DNI dorso</option>
            <option value="SELFIE">Selfie de validación</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Archivo
          <input
            className="border-ink/20 mt-2 block w-full rounded-xl border border-dashed bg-white/70 px-4 py-4 text-sm"
            name="document"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            disabled={!editable}
            required
          />
        </label>
        {editable ? (
          <button
            className="button-primary disabled:cursor-wait disabled:opacity-60"
            type="submit"
            disabled={pending}
          >
            {pending ? "Subiendo…" : "Subir documento privado"}
          </button>
        ) : (
          <p
            className="bg-moss/10 text-moss rounded-xl px-4 py-3 text-sm"
            role="status"
          >
            Este estado es de solo lectura mientras se revisa tu identidad.
          </p>
        )}
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
      </form>
    </section>
  );
}
