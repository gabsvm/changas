import Link from "next/link";

export type AccountMenuIcon =
  | "profile"
  | "identity"
  | "saved"
  | "activity"
  | "settings";

function AccountIcon({ name }: { name: AccountMenuIcon }) {
  if (name === "profile") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.5 20c.8-3.7 3-5.5 6.5-5.5s5.7 1.8 6.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "identity") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6.5 16c.6-1.5 1.4-2.2 2.5-2.2s1.9.7 2.5 2.2M14 10h3.5M14 14h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "saved") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M6 4.5h12v16l-6-4-6 4v-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "activity") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M6.5 9a5.5 5.5 0 0 1 11 0v3.5l2 3H4.5l2-3V9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AccountMenuItem({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: AccountMenuIcon;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="border-ink/10 hover:border-ink/20 hover:bg-surface flex min-h-16 items-center gap-3 border-b px-1 py-3 transition-colors last:border-b-0"
    >
      <span className="bg-moss/8 text-moss grid h-10 w-10 shrink-0 place-items-center rounded-xl">
        <AccountIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        {description ? (
          <span className="text-ink/55 mt-0.5 block text-xs leading-5">
            {description}
          </span>
        ) : null}
      </span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="text-ink/35 h-5 w-5 shrink-0" fill="none">
        <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
