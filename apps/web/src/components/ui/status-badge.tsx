import type { ProviderStatusTone } from "@/lib/ui/provider-status";

const toneClasses: Record<ProviderStatusTone, string> = {
  neutral: "bg-ink/7 text-ink/70",
  warning: "bg-warning/12 text-warning",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: ProviderStatusTone;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-[0.7rem] font-bold tracking-[0.08em] uppercase ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
