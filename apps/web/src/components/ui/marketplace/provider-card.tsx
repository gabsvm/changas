import Link from "next/link";

import { Avatar } from "./avatar";

export function ProviderCard({
  href,
  name,
  avatarUrl,
  subtitle,
  meta,
}: {
  href: string;
  name: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  meta?: string | null;
}) {
  return (
    <Link
      href={href}
      className="consumer-pressable consumer-card bg-surface group flex min-h-16 items-center gap-3 border border-transparent p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/[0.08] hover:shadow-[0_2px_4px_rgb(23_20_15/5%),0_16px_36px_-10px_rgb(23_20_15/20%)] dark:hover:border-white/10 dark:hover:shadow-[0_16px_36px_-10px_rgb(0_0_0/70%)]"
    >
      <Avatar name={name} src={avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-[15px] font-bold">
          {name}
        </span>
        {subtitle ? (
          <span className="text-ink/70 mt-0.5 block truncate text-sm">
            {subtitle}
          </span>
        ) : null}
        {meta ? (
          <span className="text-ink/70 mt-0.5 block truncate text-[13px]">
            {meta}
          </span>
        ) : null}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="text-ink/70 h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
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
  );
}
