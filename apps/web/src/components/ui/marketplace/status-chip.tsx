import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink/70",
  info: "bg-focus/10 text-focus",
  success: "bg-success/10 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/10 text-danger",
  brand:
    "bg-brand-primary/[0.08] text-brand-primary dark:bg-white/10 dark:text-white",
};

export function StatusChip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
