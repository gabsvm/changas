"use client";

import { useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/ui/marketplace/action-button";
import {
  FormField,
  marketplaceInputClass,
  marketplaceTextareaClass,
} from "@/components/ui/marketplace/form-field";
import { createNeedAction } from "../actions";

const STORAGE_KEY = "yalo:need-draft:session";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

type Draft = {
  skillId: string;
  title: string;
  description: string;
  locationText: string;
  scheduleStartAt: string;
  scheduleEndAt: string;
  desiredBudgetAmount: string;
};
const EMPTY: Draft = {
  skillId: "",
  title: "",
  description: "",
  locationText: "",
  scheduleStartAt: "",
  scheduleEndAt: "",
  desiredBudgetAmount: "",
};

export function NeedWizard({
  skills,
  idempotencyKey,
}: {
  skills: { id: string; name: string }[];
  idempotencyKey: string;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === "undefined") return EMPTY;
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { data?: Draft; savedAt?: number };
        if (
          parsed.data &&
          parsed.savedAt &&
          Date.now() - parsed.savedAt < MAX_AGE_MS
        ) {
          return { ...EMPTY, ...parsed.data };
        }
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage can be unavailable in private browsing.
    }
    return EMPTY;
  });
  const isMountedRef = useRef(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data: draft, savedAt: Date.now() }),
      );
    } catch {
      // Form still works without browser storage.
    }
  }, [draft]);

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function next() {
    const form = formRef.current;
    if (!form) return;
    const fields = form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(
      `[data-step="${step}"] input:not([type=hidden]), [data-step="${step}"] textarea, [data-step="${step}"] select`,
    );
    for (const input of Array.from(fields)) {
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
    }
    if (
      step === 1 &&
      draft.scheduleStartAt &&
      draft.scheduleEndAt &&
      new Date(draft.scheduleEndAt) <= new Date(draft.scheduleStartAt)
    ) {
      setError("La fecha de fin debe ser posterior al inicio.");
      return;
    }
    setStep((prev) => Math.min(2, prev + 1));
  }

  return (
    <form
      action={createNeedAction}
      ref={formRef}
      className="mt-6 flex flex-col gap-5"
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <nav
        aria-label="Progreso de la publicación"
        className="grid grid-cols-3 gap-2"
      >
        {["Qué necesitás", "Cuándo y dónde", "Revisar"].map((label, index) => (
          <div
            key={label}
            className={`rounded-xl px-2 py-3 text-center text-xs font-bold ${index === step ? "bg-ink text-white" : "bg-surface text-ink/60"}`}
            aria-current={index === step ? "step" : undefined}
          >
            {index + 1}. {label}
          </div>
        ))}
      </nav>

      <div
        data-step="0"
        hidden={step !== 0}
        className={step === 0 ? "grid gap-5" : "hidden"}
      >
        <FormField label="¿Qué rubro necesitás?">
          <select
            name="skillId"
            value={draft.skillId}
            required={step === 0}
            className={marketplaceInputClass}
            onChange={(event) => change("skillId", event.target.value)}
          >
            <option value="" disabled>
              Elegí un rubro
            </option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Título"
          helper="Describí la tarea en una frase (10 a 120 caracteres)."
        >
          <input
            name="title"
            value={draft.title}
            onChange={(event) => change("title", event.target.value)}
            required={step === 0}
            minLength={10}
            maxLength={120}
            placeholder="Ej: Necesito arreglar una pérdida de agua"
            className={marketplaceInputClass}
          />
        </FormField>
        <FormField
          label="Descripción"
          helper="Contá el alcance del trabajo. No incluyas DNI, teléfonos ni dirección exacta."
        >
          <textarea
            name="description"
            value={draft.description}
            onChange={(event) => change("description", event.target.value)}
            required={step === 0}
            minLength={20}
            maxLength={4000}
            rows={5}
            placeholder="Contá qué necesitás y qué esperás recibir..."
            className={marketplaceTextareaClass}
          />
        </FormField>
      </div>

      <div
        data-step="1"
        hidden={step !== 1}
        className={step === 1 ? "grid gap-5" : "hidden"}
      >
        <FormField label="Barrio o zona (opcional)">
          <input
            name="locationText"
            maxLength={200}
            value={draft.locationText}
            onChange={(event) => change("locationText", event.target.value)}
            placeholder="Ej: Palermo, CABA — sin dirección exacta"
            className={marketplaceInputClass}
          />
        </FormField>
        <FormField label="Inicio deseado (opcional)">
          <input
            name="scheduleStartAt"
            type="datetime-local"
            value={draft.scheduleStartAt}
            onChange={(event) => change("scheduleStartAt", event.target.value)}
            className={marketplaceInputClass}
          />
        </FormField>
        <FormField label="Fin deseado (opcional)">
          <input
            name="scheduleEndAt"
            type="datetime-local"
            value={draft.scheduleEndAt}
            onChange={(event) => change("scheduleEndAt", event.target.value)}
            className={marketplaceInputClass}
          />
        </FormField>
        <FormField label="Presupuesto orientativo ARS (opcional)">
          <input
            name="desiredBudgetAmount"
            inputMode="decimal"
            value={draft.desiredBudgetAmount}
            onChange={(event) =>
              change("desiredBudgetAmount", event.target.value)
            }
            placeholder="Ej: 80.000"
            className={marketplaceInputClass}
          />
        </FormField>
        <p className="text-ink/60 text-xs">
          La cifra es solo orientativa: cada prestador presenta su cotización.
        </p>
      </div>

      {step === 2 ? (
        <section
          data-step="2"
          className="bg-surface border-ink/10 rounded-2xl border p-4"
        >
          <h2 className="font-display text-lg font-bold">
            Revisá antes de publicar
          </h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-ink/60">Trabajo</dt>
              <dd className="font-bold">{draft.title}</dd>
            </div>
            <div>
              <dt className="text-ink/60">Descripción</dt>
              <dd className="whitespace-pre-wrap">{draft.description}</dd>
            </div>
            <div>
              <dt className="text-ink/60">Zona</dt>
              <dd>{draft.locationText || "A coordinar"}</dd>
            </div>
            <div>
              <dt className="text-ink/60">Presupuesto</dt>
              <dd>{draft.desiredBudgetAmount || "A convenir"}</dd>
            </div>
          </dl>
          <p className="text-ink/70 mt-4 text-xs leading-5">
            Tu publicación será visible para prestadores del rubro. La
            contratación y el precio final solo quedan confirmados cuando elegís
            una propuesta.
          </p>
          <p className="text-ink/60 mt-2 text-xs">
            Borrador temporal en esta pestaña. Evitá datos privados en la
            descripción.
          </p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setStep((prev) => prev - 1);
              setError("");
            }}
            className="border-ink/15 min-h-12 rounded-xl border px-5 text-sm font-bold"
          >
            Volver
          </button>
        ) : null}
        {step < 2 ? (
          <button
            type="button"
            onClick={next}
            className="consumer-pressable cta-ink min-h-12 flex-1 rounded-xl px-5 text-sm font-bold"
          >
            Continuar
          </button>
        ) : (
          <ActionButton type="submit" className="flex-1">
            Publicar necesidad
          </ActionButton>
        )}
      </div>
    </form>
  );
}
