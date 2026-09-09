import type { ReactNode } from "react";

import { ListRow } from "@/components/ui/marketplace/list-row";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import type { OnboardingStepPresentation } from "@/lib/ui/onboarding";

const stateCopy = {
  complete: "Listo",
  current: "En curso",
  pending: "Pendiente",
} as const;

function StepBadge({ step }: { step: OnboardingStepPresentation }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
        step.state === "current"
          ? "bg-brand-orange text-ink"
          : step.state === "complete"
            ? "bg-success/12 text-success"
            : "bg-ink/[0.06] text-ink/45"
      }`}
      aria-hidden="true"
    >
      {step.state === "complete" ? "✓" : step.number}
    </span>
  );
}

function StepStatus({ step }: { step: OnboardingStepPresentation }) {
  const tone =
    step.state === "current"
      ? "brand"
      : step.state === "complete"
        ? "success"
        : "neutral";

  return (
    <span className="flex items-center gap-1.5">
      <StatusChip tone={tone}>{stateCopy[step.state]}</StatusChip>
      <span className="text-ink/25 text-xl" aria-hidden="true">
        ›
      </span>
    </span>
  );
}

export function OnboardingStepCard({
  step,
  disabled = false,
}: {
  step: OnboardingStepPresentation;
  disabled?: boolean;
}) {
  const common: {
    title: ReactNode;
    description: ReactNode;
    leading: ReactNode;
    trailing: ReactNode;
    className: string;
  } = {
    title: step.title,
    description: step.description,
    leading: <StepBadge step={step} />,
    trailing: <StepStatus step={step} />,
    className:
      step.state === "current"
        ? "bg-brand-orange/[0.045] px-2"
        : "px-2",
  };

  if (disabled) {
    return (
      <div aria-disabled="true" className="opacity-60">
        <ListRow {...common} />
      </div>
    );
  }

  return <ListRow {...common} href={step.href} />;
}
