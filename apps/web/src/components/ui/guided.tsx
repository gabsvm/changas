import Link from "next/link";

import { ActionArrowIcon } from "@/components/ui/marketplace/action-arrow-icon";
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
      className={`yalo-guide border-ink/[0.08] bg-surface consumer-card rounded-3xl border p-5 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-[linear-gradient(135deg,#0D121B_0%,#1E293B_100%)] text-3xl font-extrabold text-white shadow-[0_10px_24px_-8px_rgb(13_18_27/55%)]"
        >
          {current}
        </span>
        <div className="min-w-0">
          <p className="text-ink text-xs font-extrabold tracking-[0.14em] uppercase">
            Paso {current} de {total}
          </p>
          <h2 className="font-display mt-0.5 text-2xl leading-7 font-extrabold tracking-[-0.02em]">
            {active?.action}
          </h2>
          <p className="text-ink/70 mt-0.5 text-sm leading-5">{active?.hint}</p>
        </div>
        <span
          className="ml-auto hidden shrink-0 text-right sm:block"
          aria-hidden="true"
        >
          <span className="font-display block text-3xl font-extrabold">
            {percent}%
          </span>
          <span className="text-ink/60 block text-xs font-bold">listo</span>
        </span>
      </div>
      <ol className="mt-4 flex gap-1.5" aria-hidden="true">
        {steps.map((item, index) => (
          <li
            key={item.action}
            className={`h-2 flex-1 rounded-full ${
              index < current
                ? "bg-[var(--yalo-symbol-gradient)]"
                : "bg-ink/[0.08]"
            }`}
          />
        ))}
      </ol>
      <ol className="mt-2 flex gap-1.5" aria-hidden="true">
        {steps.map((item, index) => (
          <li
            key={item.action}
            className={`min-w-0 flex-1 text-center text-[11px] leading-tight font-bold ${
              index === current - 1 ? "text-ink" : "text-ink/70"
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
      className={`bg-surface border-ink/10 rounded-2xl border p-5 ${className}`}
    >
      <h2 className="font-display text-ink text-xl leading-7 font-bold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="text-ink/70 mt-1 text-sm leading-6">{hint}</p>
      {href ? (
        <Link
          href={href}
          className="cta-ink consumer-pressable mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto"
        >
          {cta}
          <span aria-hidden="true">
            <ActionArrowIcon />
          </span>
        </Link>
      ) : null}
    </section>
  );
}
