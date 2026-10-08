import Link from "next/link";

import {
  IllustratedBadge,
  type IllustratedIconName,
  type IllustratedTone,
} from "./illustrated-badge";

export function SectionHeader({
  title,
  actionHref,
  actionLabel = "Ver todo",
  className = "",
  badge,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  badge?: { tone: IllustratedTone; icon: IllustratedIconName; label?: string };
}) {
  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-4 ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {badge ? (
          <IllustratedBadge
            tone={badge.tone}
            icon={badge.icon}
            size="sm"
            label={badge.label ?? title}
          />
        ) : null}
        <h2 className="truncate text-lg font-extrabold tracking-[-0.025em] sm:text-2xl">
          {title}
        </h2>
      </span>
      {actionHref ? (
        <Link
          href={actionHref}
          className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.08] inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold"
        >
          {actionLabel}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
          >
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}
