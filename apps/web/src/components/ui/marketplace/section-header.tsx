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
    <div className={`flex min-h-8 items-center justify-between gap-4 ${className}`}>
      <h2 className="text-lg font-bold tracking-[-0.015em] sm:text-xl">{title}</h2>
      {actionHref ? (
        <Link
          href={actionHref}
          className="consumer-pressable text-terracotta -mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold"
        >
          {actionLabel}
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}
    </div>
  );
}
