import Link from "next/link";

import type { OnboardingStepPresentation } from "@/lib/ui/onboarding";

const stateCopy = {
  complete: "Listo",
  current: "En curso",
  pending: "Pendiente",
} as const;

export function OnboardingStepCard({
  step,
  disabled = false,
}: {
  step: OnboardingStepPresentation;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
            step.state === "current"
              ? "bg-moss text-white"
              : step.state === "complete"
                ? "bg-success/12 text-success"
                : "bg-ink/7 text-ink/45"
          }`}
          aria-hidden="true"
        >
          {step.state === "complete" ? "✓" : step.number}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase ${
            step.state === "current"
              ? "bg-moss/10 text-moss"
              : step.state === "complete"
                ? "bg-success/10 text-success"
                : "bg-ink/5 text-ink/45"
          }`}
        >
          {stateCopy[step.state]}
        </span>
      </div>
      <h2 className="font-display mt-4 text-xl font-semibold">{step.title}</h2>
      <p className="text-ink/55 mt-1.5 text-sm leading-6">{step.description}</p>
      {!disabled ? (
        <span className="text-moss mt-4 inline-flex items-center gap-1 text-sm font-bold">
          {step.state === "current" ? "Continuar" : "Ver paso"}
          <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </>
  );

  const className = `border-ink/10 bg-surface block rounded-3xl border p-5 shadow-[0_8px_24px_rgba(22,56,50,0.035)] ${
    step.state === "current" ? "ring-moss/20 ring-2" : ""
  }`;

  if (disabled) {
    return (
      <div className={`${className} opacity-75`} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={step.href}
      className={`${className} hover:border-moss/30 transition-colors`}
    >
      {content}
    </Link>
  );
}
