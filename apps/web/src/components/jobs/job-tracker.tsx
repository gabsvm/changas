import type { JobTracking, TrackingStep } from "./job-tracking";

export function JobTracker({ tracking }: { tracking: JobTracking }) {
  if (tracking.exception) {
    const current = tracking.steps[tracking.currentIndex] ?? null;
    return (
      <div>
        <ol className="space-y-0" aria-label="Progreso del servicio">
          {tracking.steps.map((step) => (
            <TrackerRow key={step.key} step={step} frozen />
          ))}
        </ol>
        {current ? (
          <p className="text-ink/70 mt-3 text-xs leading-5">
            Quedó en el paso “{current.label}”.
          </p>
        ) : null}
      </div>
    );
  }
  const current = tracking.steps[tracking.currentIndex];
  return (
    <div>
      <p className="text-[13px] font-extrabold" aria-live="polite">
        Paso {tracking.currentIndex + 1} de {tracking.steps.length} ·{" "}
        {current?.label}
      </p>
      <ol className="mt-3 space-y-0" aria-label="Progreso del servicio">
        {tracking.steps.map((step) => (
          <TrackerRow key={step.key} step={step} />
        ))}
      </ol>
    </div>
  );
}

function TrackerRow({
  step,
  frozen = false,
}: {
  step: TrackingStep;
  frozen?: boolean;
}) {
  const dot =
    step.state === "done"
      ? "bg-success text-white border-success dark:text-brand-primary-strong"
      : step.state === "current" && !frozen
        ? "bg-brand-primary text-white border-brand-primary"
        : "bg-surface text-ink/40 border-ink/15 border";
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className="flex flex-col items-center" aria-hidden="true">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[13px] font-extrabold ${dot}`}
        >
          {step.state === "done"
            ? "✓"
            : step.state === "current" && !frozen
              ? "●"
              : "○"}
        </span>
        <span className="bg-ink/10 w-0.5 flex-1 last:hidden" />
      </span>
      <span className="min-w-0 pb-1">
        <span
          className={`block text-sm font-extrabold ${step.state === "todo" || frozen ? "text-ink/55" : "text-ink"}`}
        >
          {step.label}
        </span>
        <span className="text-ink/60 block text-xs leading-5">
          {step.state === "done" ? "Listo" : step.hint}
        </span>
      </span>
    </li>
  );
}
