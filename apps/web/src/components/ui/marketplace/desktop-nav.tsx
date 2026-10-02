import Link from "next/link";

const linkClass =
  "consumer-pressable text-ink/70 hover:bg-ink/[0.05] hover:text-ink inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold";

export function DesktopNav({ authenticated }: { authenticated: boolean }) {
  return (
    <nav
      aria-label="Navegación principal"
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
        <Link className={linkClass} href="/provider/onboarding">
          Ofrecer mis servicios
        </Link>
      )}
    </nav>
  );
}
