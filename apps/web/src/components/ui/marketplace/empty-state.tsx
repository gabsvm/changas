import type { ReactNode } from "react";

import { ActionLink, type ActionTone } from "./action-button";

export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  actionTone = "primary",
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  actionTone?: ActionTone;
  className?: string;
}) {
  return (
    <div
      className={`empty-state-card mx-auto max-w-md px-5 py-12 text-center ${className}`}
    >
      <div className="bg-brand-yellow/20 text-terracotta mx-auto grid h-12 w-12 place-items-center rounded-2xl text-xl">
        {icon ?? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h2 className="mt-4 text-lg font-extrabold tracking-[-0.02em]">{title}</h2>
      {description ? (
        <p className="text-ink/60 mx-auto mt-2 max-w-sm text-sm leading-6">
          {description}
        </p>
      ) : null}
      {actionHref && actionLabel ? (
        <ActionLink
          href={actionHref}
          tone={actionTone}
          className="mt-5 w-full sm:w-auto sm:min-w-52"
        >
          {actionLabel}
        </ActionLink>
      ) : null}
    </div>
  );
}
