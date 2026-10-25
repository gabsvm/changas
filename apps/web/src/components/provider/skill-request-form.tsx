"use client";

import { useActionState, useState } from "react";

import { submitSkillRequestAction } from "@/app/(provider)/skill-request-actions";
import { initialActionState } from "@/lib/forms/action-state";

export type RequestCategory = { id: string; name: string };

export function SkillRequestForm({
  categories,
}: {
  categories: RequestCategory[];
}) {
  const [state, action, pending] = useActionState(
    submitSkillRequestAction,
    initialActionState,
  );
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.hash === "#proponer-habilidad",
  );
  // La respuesta (éxito o error) siempre queda visible: deriva de la
  // respuesta, así ningún re-render la oculta.
  const hasFeedback = state.error != null || state.success != null;
  const expanded = open || hasFeedback;

  return (
    <div
      id="proponer-habilidad"
      className="border-ink/[0.08] bg-surface consumer-card scroll-mt-24 rounded-2xl border p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={expanded}
        aria-controls="proponer-habilidad-form"
        className="consumer-pressable flex min-h-11 w-full cursor-pointer items-center justify-between gap-3"
      >
        <span className="text-[15px] font-extrabold">
          Proponer una habilidad nueva
        </span>
        <span
          aria-hidden="true"
          className={`text-ink/40 shrink-0 text-xl transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {expanded ? (
        <>
          <p className="text-ink/70 mt-1.5 text-sm leading-6">
            Si lo que sabés hacer no está en el catálogo, proponelo con tu
            servicio armado. Lo revisamos y te avisamos; si se aprueba, todo
            queda creado junto.
          </p>
          {state.error ? (
            <p
              role="alert"
              className="bg-danger/[0.07] text-danger mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
            >
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p
              role="status"
              className="bg-success/[0.07] text-success mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
            >
              {state.success}
            </p>
          ) : null}
          <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Habilidad
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Ej: Instalación de termotanques"
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Rubro
              <select
                name="categoryId"
                required
                defaultValue=""
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              >
                <option value="" disabled>
                  Elegí el rubro
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              ¿Qué incluye?{" "}
              <span className="text-ink/50 font-normal">(opcional)</span>
              <textarea
                name="description"
                rows={2}
                maxLength={500}
                placeholder="Contanos en qué consiste para ubicarla bien"
                className="border-ink/10 mt-1.5 w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-base font-normal"
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Título de tu servicio
              <input
                name="serviceTitle"
                required
                minLength={3}
                maxLength={120}
                placeholder="Ej: Instalación de termotanque con garantía"
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Descripción del servicio
              <textarea
                name="serviceDescription"
                required
                minLength={20}
                rows={3}
                placeholder="Qué hacés exactamente, qué incluye y qué necesitás del cliente"
                className="border-ink/10 mt-1.5 w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-base font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Modalidad
              <select
                name="modality"
                defaultValue="BOTH"
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              >
                <option value="IN_PERSON">Presencial</option>
                <option value="REMOTE">Remoto</option>
                <option value="BOTH">Ambas</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Precio
              <select
                name="priceModel"
                defaultValue="FIXED"
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              >
                <option value="FIXED">Precio fijo</option>
                <option value="STARTING_AT">Desde</option>
                <option value="HOURLY">Por hora</option>
                <option value="PER_UNIT">Por unidad</option>
                <option value="QUOTE">A convenir</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Monto en ARS{" "}
              <span className="text-ink/50 font-normal">
                (vacío si es a convenir)
              </span>
              <input
                name="priceAmount"
                inputMode="numeric"
                placeholder="Ej: 35000"
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Unidad{" "}
              <span className="text-ink/50 font-normal">(solo por unidad)</span>
              <input
                name="priceUnit"
                maxLength={60}
                placeholder="Ej: hora, metro"
                className="border-ink/10 mt-1.5 min-h-[52px] w-full rounded-xl border bg-white px-3.5 text-base font-normal"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="consumer-pressable cta-ink inline-flex min-h-[52px] items-center justify-center rounded-xl px-4 text-[15px] font-extrabold sm:col-span-2"
            >
              {pending ? "Enviando…" : "Enviar propuesta"}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
