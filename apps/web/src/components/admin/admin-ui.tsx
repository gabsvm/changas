import type { ReactNode } from "react";

type Tone = "neutral" | "pending" | "success" | "info" | "danger" | "pink";

const toneClasses: Record<Tone, string> = {
  neutral: "border-[#334055] bg-[#1a2330] text-[#a7b0bf]",
  pending: "border-[#ffc857]/30 bg-[#ffc857]/10 text-[#ffd878]",
  success: "border-[#43c982]/30 bg-[#43c982]/10 text-[#66dda0]",
  info: "border-[#4f7dff]/30 bg-[#2563eb]/12 text-[#7ea2ff]",
  danger: "border-[#ef5350]/30 bg-[#ef5350]/10 text-[#ff7774]",
  pink: "border-[#d60060]/30 bg-[#d60060]/12 text-[#ff6aa5]",
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
        <p className="text-[0.68rem] font-extrabold tracking-[0.16em] text-[#ff7b4c] uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#98a2b3]">
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
      className={`rounded-[1.65rem] border border-[#273142] bg-[#151c27] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.16)] sm:p-5 ${className}`}
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
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-extrabold tracking-[0.04em] uppercase ${toneClasses[tone]}`}
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
    <div className="rounded-[1.5rem] border border-dashed border-[#303b4d] bg-[#111822] px-5 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[#2a3445] bg-[#0d131d] text-lg text-[#596579]">
        ✓
      </div>
      <p className="mt-3 text-sm font-extrabold text-[#d0d5dd]">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#7f8a9b]">
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
    <div className="rounded-[1.4rem] border border-[#273142] bg-[#151c27] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-[#8f99aa]">{label}</p>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full border ${toneClasses[tone]}`} />
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#697386]">{hint}</p> : null}
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
