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
      className={`empty-state-card mx-auto max-w-md px-5 py-10 text-center ${className}`}
    >
      {icon ? (
        <div className="bg-brand-yellow/20 text-terracotta mx-auto grid h-11 w-11 place-items-center rounded-full">
          {icon}
        </div>
      ) : null}
      <h2 className="mt-3 text-xl font-bold tracking-[-0.02em]">{title}</h2>
      {description ? (
        <p className="text-ink/58 mx-auto mt-2 max-w-sm text-sm leading-6">
          {description}
        </p>
      ) : null}
      {actionHref && actionLabel ? (
        <ActionLink href={actionHref} tone={actionTone} className="mt-5">
          {actionLabel}
        </ActionLink>
      ) : null}
    </div>
  );
}
