import type { ReactNode } from "react";

type Tone = "neutral" | "pending" | "success" | "info" | "danger" | "pink";

const toneClasses: Record<Tone, string> = {
  neutral: "border-ink/10 bg-ink/[0.04] text-ink/70",
  pending: "border-brand-yellow/30 bg-brand-yellow/15 text-warning",
  success: "border-success/25 bg-success/10 text-success",
  info: "border-moss/25 bg-moss/10 text-moss",
  danger: "border-danger/25 bg-danger/10 text-danger",
  pink: "border-brand-orange/25 bg-brand-orange/10 text-terracotta",
};

export function AdminPageHeader({
  eyebrow = "Operación",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display mt-1 text-2xl font-extrabold tracking-[-0.03em] text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-ink/70 mt-2 max-w-2xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-ink/[0.08] bg-surface consumer-card rounded-3xl border p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminStatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-[0.04em] uppercase ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-ink/[0.08] rounded-3xl border border-dashed px-5 py-8 text-center">
      <div className="bg-ink/[0.04] text-ink/40 mx-auto grid h-11 w-11 place-items-center rounded-2xl text-lg">
        ✓
      </div>
      <p className="text-ink mt-3 text-sm font-extrabold">{title}</p>
      {description ? (
        <p className="text-ink/70 mx-auto mt-1 max-w-md text-xs leading-5">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function AdminMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="border-ink/[0.08] bg-surface consumer-card rounded-3xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink/70 text-xs font-bold">{label}</p>
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full border ${toneClasses[tone]}`}
        />
      </div>
      <p className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] text-ink">
        {value}
      </p>
      {hint ? <p className="text-ink/60 mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function providerTone(status: string | null): Tone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "IDENTITY_PENDING":
    case "UNDER_REVIEW":
      return "pending";
    case "SUSPENDED":
    case "RESTRICTED":
    case "REJECTED":
      return "danger";
    case "PROFILE_INCOMPLETE":
      return "info";
    default:
      return "neutral";
  }
}
