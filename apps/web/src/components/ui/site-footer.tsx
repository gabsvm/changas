import Link from "next/link";

const linkClass =
  "text-ink/70 hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-ink/[0.08] text-ink/70 mt-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-4 text-[13px] font-medium ${className}`}
    >
      <span>© Changas</span>
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
