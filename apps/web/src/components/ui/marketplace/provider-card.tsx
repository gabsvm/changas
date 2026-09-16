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
      className="consumer-pressable consumer-card flex min-h-16 items-center gap-3 p-3 hover:bg-white"
    >
      <Avatar name={name} src={avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-ink">{name}</span>
        {subtitle ? <span className="text-ink/60 mt-0.5 block truncate text-sm">{subtitle}</span> : null}
        {meta ? <span className="text-ink/60 mt-0.5 block truncate text-[13px]">{meta}</span> : null}
      </span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="text-ink/50 h-5 w-5 shrink-0" fill="none">
        <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
