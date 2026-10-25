"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { isActiveLink } from "./desktop-nav";

const baseLinkClass =
  "consumer-pressable hover:bg-ink/[0.04] text-ink/70 hover:text-ink inline-flex min-h-11 items-center rounded-lg px-3";
const activeLinkClass =
  "consumer-pressable bg-ink/[0.07] text-ink inline-flex min-h-11 items-center rounded-lg px-3 font-extrabold";

function HeaderNavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActiveLink(pathname, href, exact);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? activeLinkClass : baseLinkClass}
    >
      {children}
    </Link>
  );
}

export function AccountHeaderNav({
  variant,
  needsEnabled,
  badge,
}: {
  variant: "account" | "provider";
  needsEnabled: boolean;
  badge: ReactNode;
}) {
  return (
    <nav
      className="flex items-center justify-end gap-1 text-sm font-semibold"
      aria-label={variant === "provider" ? "Proveedor" : "Cuenta"}
    >
      <HeaderNavLink href="/buscar">Buscar</HeaderNavLink>
      <HeaderNavLink href="/jobs">Trabajos</HeaderNavLink>
      {variant === "provider" ? (
        <HeaderNavLink href="/provider/manage">Mis servicios</HeaderNavLink>
      ) : null}
      {variant === "provider" && needsEnabled ? (
        <HeaderNavLink href="/oportunidades">Oportunidades</HeaderNavLink>
      ) : null}
      <HeaderNavLink href="/messages">Mensajes</HeaderNavLink>
      <HeaderNavLink href="/account/notifications">
        <span className="flex items-center gap-2">
          Notificaciones
          {badge}
        </span>
      </HeaderNavLink>
      <HeaderNavLink href="/account" exact>
        Cuenta
      </HeaderNavLink>
      {variant === "account" ? (
        <HeaderNavLink href="/account/favorites">Guardados</HeaderNavLink>
      ) : null}
    </nav>
  );
}
