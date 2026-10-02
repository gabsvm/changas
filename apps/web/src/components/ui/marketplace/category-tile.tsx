import Link from "next/link";

import { CategoryIcon } from "./category-icon";

export function CategoryTile({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description?: string | null;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="tile-soft consumer-pressable flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1.5 py-3.5 text-center"
      aria-label={description ? `${label}: ${description}` : label}
    >
      <span
        className="text-ink grid h-8 w-8 place-items-center"
        aria-hidden="true"
      >
        <CategoryIcon slug={icon} className="h-7 w-7" />
      </span>
      <span className="text-ink line-clamp-2 text-xs leading-4 font-bold">
        {label}
      </span>
    </Link>
  );
}
