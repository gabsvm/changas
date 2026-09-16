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
      className="consumer-card consumer-pressable consumer-card-pressed flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center"
      aria-label={description ? `${label}: ${description}` : label}
    >
      <span
        className="bg-brand-yellow/25 text-terracotta grid h-12 w-12 place-items-center rounded-2xl"
        aria-hidden="true"
      >
        <CategoryIcon slug={icon} className="h-6 w-6" />
      </span>
      <span className="text-ink line-clamp-2 text-xs leading-4 font-bold">{label}</span>
    </Link>
  );
}
