import Link from "next/link";
import type { ReactNode } from "react";

export function MobileAppBar({
  title,
  backHref,
  trailing,
}: {
  title: string;
  backHref?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="border-ink/10 flex min-h-16 items-center gap-2 border-b py-2 sm:hidden">
      <div className="flex w-12 shrink-0 justify-start">
        {backHref ? (
          <Link
            href={backHref}
            className="hover:bg-ink/5 grid h-12 w-12 place-items-center rounded-xl"
            aria-label="Volver"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
            >
              <path
                d="m14.5 5-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : null}
      </div>
      <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold">
        {title}
      </h1>
      <div className="flex w-12 shrink-0 justify-end">{trailing}</div>
    </header>
  );
}
