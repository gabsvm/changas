import type { ReactNode } from "react";

export const marketplaceInputClass =
  "consumer-control focus:border-moss/45 focus:ring-moss/10 mt-1.5 min-h-[52px] w-full px-3.5 py-3 text-base font-medium text-ink outline-none transition focus:ring-2 placeholder:text-ink/40 disabled:bg-ink/[0.035] disabled:text-ink/45";

export const marketplaceTextareaClass = `${marketplaceInputClass} min-h-28 resize-y leading-6`;

export function FormField({
  label,
  helper,
  error,
  children,
  className = "",
}: {
  label: string;
  helper?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-bold text-ink ${className}`}>
      {label}
      {children}
      {error ? (
        <span className="text-danger mt-1.5 block text-[13px] leading-5" role="alert">
          {error}
        </span>
      ) : helper ? (
        <span className="text-ink/60 mt-1.5 block text-[13px] leading-5 font-normal">
          {helper}
        </span>
      ) : null}
    </label>
  );
}
