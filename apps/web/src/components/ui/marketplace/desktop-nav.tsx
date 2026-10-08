import Link from "next/link";

const linkClass =
  "consumer-pressable text-ink/70 hover:bg-ink/[0.05] hover:text-ink inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white";
const ctaClass =
  "consumer-pressable brand-gradient-surface inline-flex min-h-11 items-center rounded-full px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgb(255_107_53/70%)]";

export function DesktopNav({ authenticated }: { authenticated: boolean }) {
  return (
    <nav
      aria-label="Navegación del sitio"
      className="hidden items-center gap-1 sm:flex"
    >
      <Link className={linkClass} href="/buscar">
        Buscar
      </Link>
      {authenticated ? (
        <>
          <Link className={linkClass} href="/messages">
            Mensajes
          </Link>
          <Link className={linkClass} href="/jobs">
            Trabajos
          </Link>
          <Link className={linkClass} href="/account/notifications">
            Actividad
          </Link>
          <Link className={linkClass} href="/account">
            Cuenta
          </Link>
        </>
      ) : (
        <Link className={ctaClass} href="/provider/onboarding">
          Ofrecer mis servicios
        </Link>
      )}
    </nav>
  );
}
