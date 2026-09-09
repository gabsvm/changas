import Link from "next/link";
import type { ReactNode } from "react";

const baseClass =
  "consumer-pressable flex min-h-14 w-full items-center gap-3 py-3 text-left";

export function ListRow({
  title,
  description,
  leading,
  trailing,
  href,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-semibold text-ink">
          {title}
        </span>
        {description ? (
          <span className="text-ink/55 mt-0.5 block text-sm leading-5">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ?? (href ? <span className="text-ink/30 text-xl">›</span> : null)}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} rounded-lg px-1 hover:bg-ink/[0.035] ${className}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={`${baseClass} ${className}`}>{content}</div>;
}
