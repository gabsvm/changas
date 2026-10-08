"use client";

import { useFormStatus } from "react-dom";

export function ConsultButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="consumer-pressable cta-ink relative inline-flex min-h-[52px] shrink-0 items-center justify-center overflow-hidden rounded-2xl px-6 text-[15px] font-extrabold shadow-[0_6px_16px_rgba(255,107,53,0.22)] disabled:cursor-wait disabled:opacity-60"
      type="submit"
      disabled={pending}
      aria-label={pending ? "Enviando consulta" : "Consultar por este servicio"}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
          backgroundSize: "10px 10px",
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -right-4 -bottom-6 h-16 w-16 rounded-full bg-white/20"
        aria-hidden="true"
      />
      <span className="relative">{pending ? "Enviando…" : "Consultar"}</span>
    </button>
  );
}
