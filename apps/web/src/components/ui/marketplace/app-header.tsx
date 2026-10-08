import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({
  title,
  backHref,
  action,
  desktopNav,
  brand = false,
  className = "",
}: {
  title?: string;
  backHref?: string | undefined;
  action?: ReactNode;
  desktopNav?: ReactNode;
  brand?: boolean;
  className?: string;
}) {
  return (
    <header
      className={`consumer-app-header border-ink/[0.06] relative sticky top-0 z-30 -mx-4 flex min-h-14 items-center gap-2.5 overflow-hidden border-b bg-gradient-to-b from-white/95 via-[#fbf8f3]/92 to-[#fbf8f3]/85 px-4 backdrop-blur-xl sm:static sm:mx-0 sm:rounded-2xl sm:border sm:from-white/80 sm:via-white/60 sm:to-white/40 sm:px-4 sm:shadow-[0_8px_24px_-12px_rgb(23_20_15/18%)] dark:from-[#1c1917]/95 dark:via-[#1c1917]/90 dark:to-[#1c1917]/80 dark:sm:from-[#1c1917]/80 dark:sm:via-[#1c1917]/60 dark:sm:to-[#1c1917]/40 ${className}`}
    >
      <span
        aria-hidden="true"
        className="brand-gradient-surface pointer-events-none absolute inset-x-0 bottom-0 h-[2px] opacity-70 sm:rounded-b-2xl"
      />
      {backHref ? (
        <Link
          href={backHref}
          className="consumer-pressable text-ink hover:bg-ink/[0.05] -ml-2 grid h-12 w-12 shrink-0 place-items-center rounded-full sm:hidden"
          aria-label="Volver"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
          >
            <path
              d="m15 5-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : brand ? (
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          aria-label="Changas, inicio"
        >
          <span className="brand-mark h-9 w-9" aria-hidden="true">
            C
          </span>
          <span className="truncate text-lg font-bold tracking-[-0.025em]">
            Changas
          </span>
        </Link>
      ) : null}

      {backHref ? (
        <Link
          href="/"
          className="hidden min-w-0 items-center gap-2.5 sm:flex"
          aria-label="Changas, inicio"
        >
          <span className="brand-mark h-9 w-9" aria-hidden="true">
            C
          </span>
          <span className="truncate text-lg font-bold tracking-[-0.025em]">
            Changas
          </span>
        </Link>
      ) : null}

      {title ? (
        <span
          className={`min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-[-0.02em] ${backHref ? "sm:hidden" : ""}`}
        >
          {title}
        </span>
      ) : (
        <span className="flex-1" />
      )}

      {desktopNav ? (
        <div className="ml-auto hidden shrink-0 sm:block">{desktopNav}</div>
      ) : null}

      {action ? (
        <div className={`${desktopNav ? "" : "ml-auto"}shrink-0`}>{action}</div>
      ) : backHref ? (
        <span className="h-12 w-12" aria-hidden="true" />
      ) : null}
    </header>
  );
}
