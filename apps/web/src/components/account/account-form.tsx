"use client";

import { useActionState } from "react";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

type AccountAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const inputClass =
  "mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-moss focus:ring-2 focus:ring-moss/20";

export function AccountForm({
  action,
  initialValues,
}: {
  action: AccountAction;
  initialValues: {
    displayName: string;
    publicZone: string;
    bio: string;
    avatarUrl: string;
    legalName: string;
    privatePhone: string;
    dateOfBirth: string;
    exactAddress: string;
    dniNumber: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
        <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
          Visible
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold">
          Tu perfil público
        </h2>
        <p className="text-ink/60 mt-2 text-sm leading-6">
          Estos datos podrán formar parte de tu presentación cuando habilitemos
          el descubrimiento.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Nombre visible
            <input
              className={inputClass}
              name="displayName"
              defaultValue={initialValues.displayName}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label className="block text-sm font-semibold">
            Zona aproximada
            <input
              className={inputClass}
              name="publicZone"
              defaultValue={initialValues.publicZone}
              maxLength={120}
            />
          </label>
        </div>
        <label className="mt-5 block text-sm font-semibold">
          Bio
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            name="bio"
            defaultValue={initialValues.bio}
            maxLength={1000}
          />
        </label>
        <label className="mt-5 block text-sm font-semibold">
          URL de foto
          <input
            className={inputClass}
            name="avatarUrl"
            type="url"
            defaultValue={initialValues.avatarUrl}
            maxLength={2048}
            inputMode="url"
          />
        </label>
      </section>

      <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
        <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
          Privado
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold">
          Datos para identidad
        </h2>
        <p className="text-ink/60 mt-2 text-sm leading-6">
          Solo los usa tu cuenta para onboarding y revisión. No se publican en
          perfiles ni enlaces.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Nombre legal
            <input
              className={inputClass}
              name="legalName"
              defaultValue={initialValues.legalName}
              maxLength={160}
              autoComplete="name"
            />
          </label>
          <label className="block text-sm font-semibold">
            Teléfono privado
            <input
              className={inputClass}
              name="privatePhone"
              defaultValue={initialValues.privatePhone}
              maxLength={40}
              autoComplete="tel"
            />
          </label>
          <label className="block text-sm font-semibold">
            Fecha de nacimiento
            <input
              className={inputClass}
              name="dateOfBirth"
              type="date"
              defaultValue={initialValues.dateOfBirth}
              autoComplete="bday"
            />
          </label>
          <label className="block text-sm font-semibold">
            DNI
            <input
              className={inputClass}
              name="dniNumber"
              defaultValue={initialValues.dniNumber}
              maxLength={40}
              autoComplete="off"
            />
          </label>
        </div>
        <label className="mt-5 block text-sm font-semibold">
          Domicilio exacto
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            name="exactAddress"
            defaultValue={initialValues.exactAddress}
            maxLength={240}
            autoComplete="street-address"
          />
        </label>
      </section>

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
        className="button-primary w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        type="submit"
        disabled={pending}
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function StartProviderForm({ action }: { action: AccountAction }) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className="mt-6">
      {state.error ? (
        <p
          className="bg-terracotta/10 text-terracotta mb-4 rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        className="button-primary disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "Preparando…" : "Empezar onboarding de proveedor"}
      </button>
    </form>
  );
}
