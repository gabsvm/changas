"use client";

import { useActionState, useState } from "react";

import { ActionButton } from "@/components/ui/marketplace/action-button";
import {
  FormField,
  marketplaceInputClass,
  marketplaceTextareaClass,
} from "@/components/ui/marketplace/form-field";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import type { ActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

type AccountAction = (
  previousState: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type HiddenFields = Record<string, string>;

function FormStatus({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="bg-danger/8 text-danger rounded-xl px-3 py-2.5 text-sm" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        className="bg-success/8 text-success rounded-xl px-3 py-2.5 text-sm"
        role="status"
        aria-live="polite"
      >
        {state.success}
      </p>
    );
  }
  return null;
}

function HiddenFormFields({ fields }: { fields: HiddenFields | undefined }) {
  if (!fields) return null;
  return Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

export type PublicProfileInitialValues = {
  displayName: string;
  publicZone: string;
  bio: string;
};

export function PublicProfileForm({
  action,
  initialValues,
  submitLabel = "Guardar cambios",
  hiddenFields,
}: {
  action: AccountAction;
  initialValues: PublicProfileInitialValues;
  submitLabel?: string;
  hiddenFields?: HiddenFields;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [bioLength, setBioLength] = useState(initialValues.bio.length);

  return (
    <form action={formAction} className="space-y-5">
      <HiddenFormFields fields={hiddenFields} />

      <FormField
        label="Nombre visible"
        helper="Es el nombre que van a ver otras personas."
      >
        <input
          className={marketplaceInputClass}
          name="displayName"
          defaultValue={initialValues.displayName}
          minLength={2}
          maxLength={80}
          autoComplete="name"
          required
        />
      </FormField>

      <FormField
        label="Zona aproximada"
        helper="Tu domicilio exacto nunca se publica."
      >
        <input
          className={marketplaceInputClass}
          name="publicZone"
          defaultValue={initialValues.publicZone}
          maxLength={120}
          placeholder="Ej. Palermo, CABA"
          autoComplete="address-level2"
        />
      </FormField>

      <FormField
        label="Presentación"
        helper={
          <span className="flex items-start justify-between gap-4">
            <span>Contá en pocas líneas qué hacés y cómo trabajás.</span>
            <span className="shrink-0" aria-live="polite">
              {bioLength}/1000
            </span>
          </span>
        }
      >
        <textarea
          className={marketplaceTextareaClass}
          name="bio"
          defaultValue={initialValues.bio}
          maxLength={1000}
          placeholder="Ej. Trabajo con instalaciones eléctricas domiciliarias…"
          onChange={(event) => setBioLength(event.currentTarget.value.length)}
        />
      </FormField>

      <FormStatus state={state} />

      <StickyActionBar>
        <ActionButton className="w-full sm:w-auto" type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </ActionButton>
      </StickyActionBar>
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
  hiddenFields,
}: {
  action: AccountAction;
  initialValues: PrivateIdentityInitialValues;
  submitLabel?: string;
  hiddenFields?: HiddenFields;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      <HiddenFormFields fields={hiddenFields} />

      <FormField label="Nombre legal">
        <input
          className={marketplaceInputClass}
          name="legalName"
          defaultValue={initialValues.legalName}
          maxLength={160}
          autoComplete="name"
        />
      </FormField>

      <FormField label="Teléfono privado">
        <input
          className={marketplaceInputClass}
          name="privatePhone"
          defaultValue={initialValues.privatePhone}
          maxLength={40}
          autoComplete="tel"
          inputMode="tel"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Fecha de nacimiento">
          <input
            className={marketplaceInputClass}
            name="dateOfBirth"
            type="date"
            defaultValue={initialValues.dateOfBirth}
            autoComplete="bday"
          />
        </FormField>
        <FormField label="DNI">
          <input
            className={marketplaceInputClass}
            name="dniNumber"
            defaultValue={initialValues.dniNumber}
            maxLength={40}
            inputMode="numeric"
            autoComplete="off"
          />
        </FormField>
      </div>

      <FormField
        label="Domicilio exacto"
        helper="Sólo se usa para procesos internos que realmente lo requieren."
      >
        <textarea
          className={marketplaceTextareaClass}
          name="exactAddress"
          defaultValue={initialValues.exactAddress}
          maxLength={240}
          autoComplete="street-address"
        />
      </FormField>

      <FormStatus state={state} />

      <StickyActionBar>
        <ActionButton className="w-full sm:w-auto" type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </ActionButton>
      </StickyActionBar>
    </form>
  );
}

export function StartProviderForm({ action }: { action: AccountAction }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="mt-3">
      {state.error ? (
        <p className="text-danger mb-2 text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <ActionButton className="w-full sm:w-auto" type="submit" disabled={pending}>
        {pending ? "Preparando…" : "Empezar como proveedor"}
      </ActionButton>
    </form>
  );
}
