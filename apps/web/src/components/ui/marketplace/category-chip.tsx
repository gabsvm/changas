import Link from "next/link";

export function CategoryChip({
  href,
  label,
  description,
  active = false,
}: {
  href: string;
  label: string;
  description?: string | null;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`consumer-pressable inline-flex min-h-11 min-w-[8.5rem] shrink-0 flex-col justify-center rounded-2xl px-3 py-2.5 ${
        active
          ? "border border-transparent bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_48%,#FF0A78_100%)] text-white shadow-[0_10px_24px_-8px_rgb(255_107_53/55%)] hover:brightness-[1.06] dark:shadow-[0_10px_24px_-8px_rgb(0_0_0/70%)]"
          : "border-ink/8 bg-surface hover:border-brand-orange/30 border shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] hover:-translate-y-px hover:bg-white dark:hover:bg-white/5"
      }`}
    >
      <span className="truncate text-sm font-bold">{label}</span>
      {description ? (
        <span
          className={`mt-0.5 line-clamp-1 text-xs ${active ? "text-white/80" : "text-ink/70"}`}
        >
          {description}
        </span>
      ) : null}
    </Link>
  );
}
