"use client";

import { useFormStatus } from "react-dom";

export function ConsultButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="consumer-pressable bg-brand-orange text-ink inline-flex min-h-[52px] shrink-0 items-center justify-center rounded-2xl px-6 text-[15px] font-extrabold shadow-[0_6px_16px_rgba(255,107,53,0.22)] disabled:cursor-wait disabled:opacity-60"
      type="submit"
      disabled={pending}
      aria-label={pending ? "Enviando consulta" : "Consultar por este servicio"}
    >
      {pending ? "Enviando…" : "Consultar"}
    </button>
  );
}
