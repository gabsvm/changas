import Link from "next/link";

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
      className="consumer-card consumer-pressable flex min-h-12 w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-center hover:-translate-y-0.5 hover:bg-white"
      aria-label={description ? `${label}: ${description}` : label}
    >
      <span
        className="bg-brand-yellow grid h-11 w-11 place-items-center rounded-2xl text-xl"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-ink text-[0.72rem] leading-4 font-bold">
        {label}
      </span>
    </Link>
  );
}
