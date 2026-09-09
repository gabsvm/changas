import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ActionTone = "primary" | "secondary" | "ghost" | "danger";

export function actionButtonClass(
  tone: ActionTone = "primary",
  className = "",
): string {
  const base =
    "consumer-pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold outline-none transition disabled:cursor-not-allowed disabled:opacity-55";
  const tones: Record<ActionTone, string> = {
    primary:
      "bg-brand-orange text-ink shadow-[0_5px_14px_rgba(255,107,53,0.16)] hover:bg-[#f75b29]",
    secondary:
      "border border-ink/10 bg-white text-ink hover:border-ink/16 hover:bg-surface",
    ghost: "bg-transparent text-ink/70 hover:bg-ink/[0.045] hover:text-ink",
    danger: "bg-danger text-white hover:bg-[#b9342c]",
  };

  return `${base} ${tones[tone]} ${className}`.trim();
}

export function ActionLink({
  href,
  children,
  tone = "primary",
  className = "",
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  tone?: ActionTone;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      className={actionButtonClass(tone, className)}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

export function ActionButton({
  tone = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ActionTone;
  children: ReactNode;
}) {
  return (
    <button {...props} className={actionButtonClass(tone, className)}>
      {children}
    </button>
  );
}
