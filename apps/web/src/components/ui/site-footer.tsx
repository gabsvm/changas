import Link from "next/link";

const linkClass =
  "text-ink/70 hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-ink/[0.08] text-ink/70 relative mt-10 flex flex-wrap items-center gap-x-5 gap-y-1 overflow-hidden border-t pt-4 text-[13px] font-medium ${className}`}
    >
      <span
        aria-hidden="true"
        className="brand-gradient-surface pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-60"
      />
      <span className="flex items-center gap-2 font-bold text-ink dark:text-white">
        <span className="brand-mark h-6 w-6 !rounded-lg" aria-hidden="true">
          C
        </span>
        © Changas
      </span>
      <nav
        aria-label="Información legal"
        className="flex flex-wrap items-center gap-x-5"
      >
        <Link className={linkClass} href="/terminos">
          Términos
        </Link>
        <Link className={linkClass} href="/privacidad">
          Privacidad
        </Link>
        <Link className={linkClass} href="/cookies">
          Cookies
        </Link>
      </nav>
    </footer>
  );
}
