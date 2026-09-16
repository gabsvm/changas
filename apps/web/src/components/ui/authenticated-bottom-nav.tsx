"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getAuthenticatedNavKey,
  type AuthenticatedNavKey,
} from "@/lib/ui/navigation";

type NavItem = {
  key: AuthenticatedNavKey;
  label: string;
  href: string;
  icon: "home" | "search" | "messages" | "activity" | "account";
  central?: boolean;
};

const items: NavItem[] = [
  { key: "home", label: "Inicio", href: "/", icon: "home" },
  { key: "search", label: "Buscar", href: "/buscar", icon: "search", central: true },
  { key: "messages", label: "Mensajes", href: "/messages", icon: "messages" },
  {
    key: "activity",
    label: "Actividad",
    href: "/account/notifications",
    icon: "activity",
  },
  { key: "account", label: "Cuenta", href: "/account", icon: "account" },
];

function NavIcon({ name, active }: { name: NavItem["icon"]; active: boolean }) {
  const stroke = active ? 2.1 : 1.8;
  const fill = active ? "currentColor" : "none";
  const fillOpacity = active ? 0.16 : 0;
  if (name === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path
          d="M3.5 10.5 12 3l8.5 7.5v9A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <path
          d="M9 21v-6h6v6"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth={stroke} />
        <path
          d="m16 16 4.5 4.5"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "messages") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path
          d="M4 5.5h16v11H9l-5 4v-15Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <path
          d="M8 10h8M8 13.5h5"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "activity") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path
          d="M6.5 9a5.5 5.5 0 0 1 11 0v3.5l2 3H4.5l2-3V9Z"
          fill={fill}
          fillOpacity={fillOpacity}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <path
          d="M10 19a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        fill={fill}
        fillOpacity={fillOpacity}
        stroke="currentColor"
        strokeWidth={stroke}
      />
      <path
        d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AuthenticatedBottomNav({
  unreadCount,
  unreadMessages = 0,
}: {
  unreadCount: number;
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const activeKey = getAuthenticatedNavKey(pathname);

  return (
    <nav
      className="mobile-safe-bottom bg-surface/98 border-ink/[0.07] fixed inset-x-0 bottom-0 z-50 border-t px-2 pt-1 backdrop-blur-xl sm:hidden"
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid h-[var(--consumer-nav-height)] max-w-md grid-cols-5">
        {items.map((item) => {
          const active = item.key === activeKey;
          const badge =
            item.key === "activity" ? unreadCount : item.key === "messages" ? unreadMessages : 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`consumer-pressable relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[0.68rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-moss/45 ${
                active ? "text-ink" : "text-ink/55 hover:text-ink/80"
              }`}
            >
              <span
                className={`relative grid place-items-center rounded-full transition-colors ${
                  item.central && active
                    ? "bg-ink h-12 w-12 text-white shadow-lg"
                    : item.central
                      ? "bg-ink/[0.06] h-12 w-12 text-ink"
                      : "h-6 w-6"
                }`}
              >
                <NavIcon name={item.icon} active={active} />
                {badge > 0 ? (
                  <span
                    className="bg-brand-pink-strong absolute -top-1 -right-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.68rem] leading-5 font-bold text-white"
                    aria-label={`${badge} sin leer en ${item.label}`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              <span className={active ? "font-extrabold" : undefined}>{item.label}</span>
              {active ? (
                <span
                  className="bg-brand-orange absolute bottom-0.5 h-1 w-1 rounded-full"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
