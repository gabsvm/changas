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
  icon: "home" | "messages" | "activity" | "account";
};

const items: NavItem[] = [
  { key: "home", label: "Inicio", href: "/", icon: "home" },
  { key: "messages", label: "Mensajes", href: "/messages", icon: "messages" },
  {
    key: "activity",
    label: "Actividad",
    href: "/account/notifications",
    icon: "activity",
  },
  { key: "account", label: "Cuenta", href: "/account", icon: "account" },
];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  if (name === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none">
        <path d="M3.5 10.5 12 3l8.5 7.5v9A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-9Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "messages") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none">
        <path d="M4 5.5h16v11H9l-5 4v-15Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M8 10h8M8 13.5h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "activity") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none">
        <path d="M6.5 9a5.5 5.5 0 0 1 11 0v3.5l2 3H4.5l2-3V9Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function AuthenticatedBottomNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const activeKey = getAuthenticatedNavKey(pathname);

  return (
    <nav
      className="mobile-safe-bottom bg-surface/98 fixed inset-x-0 bottom-0 z-50 border-t border-ink/[0.07] px-2 pt-1.5 backdrop-blur-xl sm:hidden"
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid h-[var(--consumer-nav-height)] max-w-md grid-cols-4">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`consumer-pressable relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.7rem] font-semibold ${
                active ? "text-terracotta" : "text-ink/52 hover:text-ink/78"
              }`}
            >
              <span className="relative">
                <NavIcon name={item.icon} />
                {item.key === "activity" && unreadCount > 0 ? (
                  <span
                    className="bg-brand-pink-strong absolute -top-1.5 -right-2 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[0.58rem] leading-4 font-bold text-white"
                    aria-label={`${unreadCount} notificaciones sin leer`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
              {active ? (
                <span
                  className="bg-brand-orange absolute top-0 h-0.5 w-6 rounded-full"
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
