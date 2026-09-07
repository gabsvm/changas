"use client";

import { useActionState, useState } from "react";

import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

type AccountAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const inputClass =
  "border-ink/15 bg-surface focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-2xl border px-4 py-3.5 text-sm font-normal outline-none focus:ring-2";

function FormStatus({ state }: { state: ActionState }) {
  return (
    <>
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
          {state.success}
        </p>
      ) : null}
    </>
  );
}

export type PublicProfileInitialValues = {
  displayName: string;
  publicZone: string;
  bio: string;
  avatarUrl: string;
};

export function PublicProfileForm({
  action,
  initialValues,
  submitLabel = "Guardar cambios",
}: {
  action: AccountAction;
  initialValues: PublicProfileInitialValues;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const [bioLength, setBioLength] = useState(initialValues.bio.length);

  return (
    <form action={formAction} className="space-y-5">
      <label className="block text-sm font-semibold">
        Nombre visible
        <input
          className={inputClass}
          name="displayName"
          defaultValue={initialValues.displayName}
          minLength={2}
          maxLength={80}
          autoComplete="name"
          required
        />
        <span className="text-ink/50 mt-1.5 block text-xs leading-5 font-normal">
          Es el nombre que verán otras personas en tu perfil.
        </span>
      </label>

      <label className="block text-sm font-semibold">
        Zona aproximada
        <input
          className={inputClass}
          name="publicZone"
          defaultValue={initialValues.publicZone}
          maxLength={120}
          placeholder="Ej. Palermo, CABA"
        />
        <span className="text-ink/50 mt-1.5 block text-xs leading-5 font-normal">
          No mostramos tu domicilio exacto.
        </span>
      </label>

      <label className="block text-sm font-semibold">
        Bio
        <textarea
          className={`${inputClass} min-h-32 resize-y`}
          name="bio"
          defaultValue={initialValues.bio}
          maxLength={1000}
          placeholder="Contá brevemente qué hacés, tu experiencia y cómo trabajás."
          onChange={(event) => setBioLength(event.currentTarget.value.length)}
        />
        <span className="mt-1.5 flex items-start justify-between gap-4 text-xs leading-5 font-normal">
          <span className="text-ink/50">
            Una presentación breve ayuda a generar confianza.
          </span>
          <span className="text-ink/45 shrink-0" aria-live="polite">
            {bioLength}/1000
          </span>
        </span>
      </label>

      <label className="block text-sm font-semibold">
        URL de foto
        <input
          className={inputClass}
          name="avatarUrl"
          type="url"
          defaultValue={initialValues.avatarUrl}
          maxLength={2048}
          inputMode="url"
          placeholder="https://…"
        />
        <span className="text-ink/50 mt-1.5 block text-xs leading-5 font-normal">
          Por ahora usamos una URL. La carga directa de avatar queda fuera de
          este rediseño.
        </span>
      </label>

      <FormStatus state={state} />

      <div className="mobile-sticky-surface sticky bottom-0 z-20 -mx-5 px-5 pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          className="button-primary w-full sm:w-auto"
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export type PrivateIdentityInitialValues = {
  legalName: string;
  privatePhone: string;
  dateOfBirth: string;
  exactAddress: string;
  dniNumber: string;
};

export function PrivateIdentityForm({
  action,
  initialValues,
  submitLabel = "Guardar datos privados",
}: {
  action: AccountAction;
  initialValues: PrivateIdentityInitialValues;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
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
          inputMode="tel"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
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
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Domicilio exacto
        <textarea
          className={`${inputClass} min-h-28 resize-y`}
          name="exactAddress"
          defaultValue={initialValues.exactAddress}
          maxLength={240}
          autoComplete="street-address"
        />
      </label>

      <FormStatus state={state} />

      <div className="mobile-sticky-surface sticky bottom-0 z-20 -mx-5 px-5 pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          className="button-primary w-full sm:w-auto"
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function StartProviderForm({ action }: { action: AccountAction }) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  return (
    <form action={formAction} className="mt-5">
      {state.error ? (
        <p
          className="bg-danger/10 text-danger mb-4 rounded-2xl px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        className="button-primary w-full sm:w-auto"
        type="submit"
        disabled={pending}
      >
        {pending ? "Preparando…" : "Empezar como proveedor"}
      </button>
    </form>
  );
}
