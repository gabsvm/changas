import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({
  title,
  backHref,
  action,
  brand = false,
  className = "",
}: {
  title?: string;
  backHref?: string;
  action?: ReactNode;
  brand?: boolean;
  className?: string;
}) {
  return (
    <header
      className={`bg-canvas/96 sticky top-0 z-30 -mx-4 flex min-h-14 items-center gap-3 border-b border-ink/[0.06] px-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none ${className}`}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="consumer-pressable -ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/75 hover:bg-ink/[0.05]"
          aria-label="Volver"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : brand ? (
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Changas, inicio">
          <span className="brand-mark h-9 w-9" aria-hidden="true">C</span>
          <span className="truncate text-lg font-bold tracking-[-0.025em]">Changas</span>
        </Link>
      ) : null}

      {title ? (
        <h1 className={`${backHref ? "text-center" : ""} min-w-0 flex-1 truncate text-[1.05rem] font-bold tracking-[-0.015em]`}>
          {title}
        </h1>
      ) : (
        <span className="flex-1" />
      )}

      {action ? <div className="ml-auto shrink-0">{action}</div> : backHref ? <span className="h-11 w-11" aria-hidden="true" /> : null}
    </header>
  );
}
