import type { ReactNode } from "react";

import { ActionLink, type ActionTone } from "./action-button";
import { IllustratedBadge, type IllustratedTone } from "./illustrated-badge";

const ACTION_TONE_TO_BADGE: Record<ActionTone | "success", IllustratedTone> = {
  primary: "orange",
  secondary: "blue",
  danger: "rose",
  ghost: "neutral",
  success: "green",
};
export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  actionTone = "primary",
  tone,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  actionTone?: ActionTone;
  tone?: IllustratedTone;
  className?: string;
}) {
  return (
     <div
      className={`empty-state-card mx-auto max-w-md px-5 py-12 text-center ${className}`}
    >
      <div className="flex justify-center">
        {icon ?? (
          <IllustratedBadge
            tone={tone ?? ACTION_TONE_TO_BADGE[actionTone]}
            icon="sparkle"
            size="lg"
          />
        )}
      </div>
      <h2 className="mt-4 text-lg font-extrabold tracking-[-0.02em]">
        {title}
      </h2>
      {description ? (
        <p className="text-ink/70 mx-auto mt-2 max-w-sm text-sm leading-6">
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
