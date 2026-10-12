import Link from "next/link";

import { guideProgress, type GuidedStep } from "@/lib/ui/guided";

/**
 * Encabezado guiado: número gigante, "Paso X de Y", una acción en
 * ultracorto y segmentos de progreso. Una sola cosa para mirar.
 */
export function GuideHeader({
  step,
  steps,
  className = "",
}: {
  step: number;
  steps: readonly GuidedStep[];
  className?: string;
}) {
  const total = steps.length;
  const current = Math.min(total, Math.max(1, Math.trunc(step) || 1));
  const active = steps[current - 1];
  const percent = guideProgress(current, total);

  return (
    <section
      aria-label={`Paso ${current} de ${total}: ${active?.action ?? ""}`}
      className={`border-ink/[0.08] bg-surface consumer-card rounded-3xl border p-5 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_55%,#FF0A78_100%)] text-3xl font-extrabold text-white shadow-[0_10px_24px_-8px_rgb(255_107_53/55%)]"
        >
          {current}
        </span>
        <div className="min-w-0">
          <p className="text-terracotta text-xs font-extrabold tracking-[0.14em] uppercase">
            Paso {current} de {total}
          </p>
          <h2 className="font-display mt-0.5 text-2xl leading-7 font-extrabold tracking-[-0.02em]">
            {active?.action}
          </h2>
          <p className="text-ink/70 mt-0.5 text-sm leading-5">{active?.hint}</p>
        </div>
        <span className="ml-auto hidden shrink-0 text-right sm:block" aria-hidden="true">
          <span className="font-display block text-3xl font-extrabold">{percent}%</span>
          <span className="text-ink/60 block text-xs font-bold">listo</span>
        </span>
      </div>
      <ol className="mt-4 flex gap-1.5" aria-hidden="true">
        {steps.map((item, index) => (
          <li
            key={item.action}
            className={`h-2 flex-1 rounded-full ${
              index < current
                ? "bg-[linear-gradient(90deg,#FF9A3D,#FF0A78)]"
                : "bg-ink/[0.08]"
            }`}
          />
        ))}
      </ol>
      <ol className="mt-2 flex gap-1.5" aria-hidden="true">
        {steps.map((item, index) => (
          <li
            key={item.action}
            className={`flex-1 truncate text-center text-[11px] font-bold ${
              index === current - 1 ? "text-ink" : "text-ink/45"
            }`}
          >
            {item.action}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Tarjeta de única acción: qué sigue + un solo botón grande.
 * Si `href` es null se muestra como espera (la pelota la tiene el otro).
 */
export function NextStepBanner({
  title,
  hint,
  cta,
  href,
  className = "",
}: {
  title: string;
  hint: string;
  cta: string;
  href: string | null;
  className?: string;
}) {
  return (
    <section
      aria-label="Qué sigue"
      className={`relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_55%,#FF0A78_100%)] p-5 text-white shadow-[0_18px_40px_-14px_rgb(255_107_53/60%)] ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgb(255 255 255 / 60%) 1px, transparent 1.5px)",
          backgroundSize: "12px 12px",
        }}
        aria-hidden="true"
      />
      <p className="relative text-[11px] font-extrabold tracking-[0.16em] text-white/80 uppercase">
        Qué sigue
      </p>
      <h2 className="font-display relative mt-1 text-[22px] leading-7 font-extrabold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="relative mt-1 text-sm leading-5 text-white/85">{hint}</p>
      {href ? (
        <Link
          href={href}
          className="consumer-pressable relative mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-white px-6 text-base font-extrabold text-[#C84010] shadow-[0_10px_24px_-10px_rgb(0_0_0/45%)] sm:w-auto sm:min-w-56"
        >
          {cta} →
        </Link>
      ) : null}
    </section>
  );
}
