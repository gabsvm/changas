import Link from "next/link";

export function SectionHeader({
  title,
  actionHref,
  actionLabel = "Ver todo",
  className = "",
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-h-11 items-center justify-between gap-4 ${className}`}>
      <h2 className="text-base font-extrabold tracking-[-0.015em] sm:text-xl">{title}</h2>
      {actionHref ? (
        <Link
          href={actionHref}
          className="consumer-pressable text-terracotta inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold hover:bg-brand-orange/[0.08]"
        >
          {actionLabel}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
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
