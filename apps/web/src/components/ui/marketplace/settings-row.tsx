import Link from "next/link";
import type { ReactNode } from "react";

export function SettingsRow({
  title,
  description,
  trailing,
  href,
  leading,
  className = "",
}: {
  title: string;
  description?: string;
  trailing?: ReactNode;
  href?: string;
  leading?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block text-[0.95rem] font-semibold text-ink">{title}</span>
        {description ? (
          <span className="text-ink/52 mt-0.5 block text-sm leading-5">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ?? (href ? <span className="text-ink/28 text-xl">›</span> : null)}
    </>
  );

  const classes = `consumer-pressable flex min-h-14 w-full items-center gap-3 py-3 ${className}`;

  if (href) {
    return (
      <Link href={href} className={`${classes} rounded-lg hover:bg-ink/[0.035]`}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
