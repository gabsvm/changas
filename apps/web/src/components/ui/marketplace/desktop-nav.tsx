"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass =
  "consumer-pressable text-ink/70 hover:bg-ink/[0.05] hover:text-ink inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white";
const activeLinkClass =
  "consumer-pressable inline-flex min-h-11 items-center rounded-full bg-[linear-gradient(135deg,#FF9A3D_0%,#FF6B35_48%,#FF0A78_100%)] px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_-8px_rgb(255_107_53/55%)] hover:brightness-[1.06]";
const ctaClass =
  "consumer-pressable brand-gradient-surface inline-flex min-h-11 items-center rounded-full px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgb(255_107_53/70%)]";

type DesktopNavLink = { href: string; label: string; exact?: boolean };

function isActiveLink(
  pathname: string,
  href: string,
  exact = false,
): boolean {
  if (pathname === href) return true;
  if (exact) return false;
  return pathname.startsWith(`${href}/`);
}

export function DesktopNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const links: DesktopNavLink[] = authenticated
    ? [
        { href: "/buscar", label: "Buscar" },
        { href: "/messages", label: "Mensajes" },
        { href: "/jobs", label: "Trabajos" },
        { href: "/account/notifications", label: "Actividad" },
        { href: "/account", label: "Cuenta", exact: true },
      ]
    : [{ href: "/buscar", label: "Buscar" }];

  return (
    <nav
      aria-label="Navegación del sitio"
      className="hidden items-center gap-1 sm:flex"
    >
      {links.map((link) => {
        const active = isActiveLink(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            className={active ? activeLinkClass : linkClass}
            href={link.href}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      {authenticated ? null : (
        <Link className={ctaClass} href="/provider/onboarding">
          Ofrecer mis servicios
        </Link>
      )}
    </nav>
  );
}
