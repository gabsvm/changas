"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  adminMoreItems,
  adminNavigationItems,
  adminPrimaryMobileItems,
  isAdminNavigationItemActive,
  type AdminNavigationId,
} from "@/lib/ui/admin-navigation";

function NavIcon({ id }: { id: AdminNavigationId | "more" }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    case "overview":
      return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
    case "identity":
      return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "providers":
      return <svg {...common}><path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"/><path d="M8 7h8"/><path d="M2 12h20"/></svg>;
    case "catalog":
      return <svg {...common}><path d="m7 7 10 10"/><path d="M6 3h5l10 10-8 8L3 11V6a3 3 0 0 1 3-3"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>;
    case "reports":
      return <svg {...common}><path d="M4 21V5a2 2 0 0 1 2-2h10l4 4v14"/><path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>;
    case "jobs":
      return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>;
    case "payments":
      return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h2"/></svg>;
    case "audit":
      return <svg {...common}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    default:
      return <svg {...common}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
  }
}

export function AdminNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = adminMoreItems.some((item) =>
    isAdminNavigationItemActive(pathname, item.href),
  );

  return (
    <>
      <aside className="admin-sidebar fixed top-[4.5rem] bottom-0 left-0 z-30 hidden w-64 border-r border-[#273142] bg-[#0d131d]/95 p-4 backdrop-blur-xl lg:block">
        <p className="px-3 pb-2 text-[0.65rem] font-extrabold tracking-[0.18em] text-[#697386] uppercase">
          Operación
        </p>
        <nav className="space-y-1" aria-label="Administración">
          {adminNavigationItems.map((item) => {
            const active = isAdminNavigationItemActive(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? "bg-[#ff6b35] text-[#10131a] shadow-[0_8px_24px_rgba(255,107,53,0.2)]"
                    : "text-[#98a2b3] hover:bg-[#171f2c] hover:text-white"
                }`}
                href={item.href}
                key={item.id}
              >
                <NavIcon id={item.id} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            type="button"
          />
          <section
            aria-label="Más secciones administrativas"
            className="mobile-safe-bottom absolute right-0 bottom-0 left-0 rounded-t-[2rem] border-t border-[#2a3445] bg-[#121923] px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#3a4557]" />
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-extrabold tracking-[0.14em] text-[#ff6b35] uppercase">
                  Administración
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-white">Más herramientas</h2>
              </div>
              <button
                className="grid min-h-12 min-w-12 place-items-center rounded-2xl border border-[#2a3445] bg-[#0d131d] text-[#98a2b3]"
                onClick={() => setMoreOpen(false)}
                type="button"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              {adminMoreItems.map((item) => {
                const active = isAdminNavigationItemActive(pathname, item.href);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold ${
                      active
                        ? "border-[#ff6b35]/50 bg-[#ff6b35]/12 text-[#ff8b63]"
                        : "border-[#273142] bg-[#171f2c] text-[#d0d5dd]"
                    }`}
                    href={item.href}
                    key={item.id}
                    onClick={() => setMoreOpen(false)}
                  >
                    <NavIcon id={item.id} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </section>
        </div>
      ) : null}

      <nav
        className="mobile-safe-bottom fixed right-0 bottom-0 left-0 z-40 grid grid-cols-4 border-t border-[#273142] bg-[#0d131d]/96 px-2 pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:hidden"
        aria-label="Administración móvil"
      >
        {adminPrimaryMobileItems.map((item) => {
          const active = isAdminNavigationItemActive(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.65rem] font-extrabold ${
                active ? "text-[#ff7b4c]" : "text-[#7f8a9b]"
              }`}
              href={item.href}
              key={item.id}
            >
              <NavIcon id={item.id} />
              {item.label}
            </Link>
          );
        })}
        <button
          aria-expanded={moreOpen}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.65rem] font-extrabold ${
            moreActive || moreOpen ? "text-[#ff7b4c]" : "text-[#7f8a9b]"
          }`}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <NavIcon id="more" />
          Más
        </button>
      </nav>
    </>
  );
}
