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
        <span className="block truncate text-sm font-bold text-ink">{name}</span>
        {subtitle ? <span className="text-ink/55 mt-0.5 block truncate text-sm">{subtitle}</span> : null}
        {meta ? <span className="text-ink/42 mt-0.5 block truncate text-xs">{meta}</span> : null}
      </span>
      <span className="text-ink/28 text-xl" aria-hidden="true">›</span>
    </Link>
  );
}
