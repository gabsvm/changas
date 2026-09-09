import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink/70",
  info: "bg-moss/10 text-moss",
  success: "bg-success/10 text-success",
  warning: "bg-brand-yellow/24 text-warning",
  danger: "bg-danger/10 text-danger",
  brand: "bg-brand-orange/12 text-terracotta",
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
