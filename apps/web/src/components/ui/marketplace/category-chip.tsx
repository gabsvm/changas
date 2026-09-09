import Link from "next/link";

export function CategoryChip({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description?: string | null;
}) {
  return (
    <Link
      href={href}
      className="consumer-pressable border-ink/8 bg-surface hover:border-brand-orange/25 flex min-h-11 min-w-[8.5rem] shrink-0 flex-col justify-center rounded-xl border px-3 py-2.5 hover:bg-white"
    >
      <span className="truncate text-sm font-bold">{label}</span>
      {description ? (
        <span className="text-ink/48 mt-0.5 line-clamp-1 text-xs">{description}</span>
      ) : null}
    </Link>
  );
}
