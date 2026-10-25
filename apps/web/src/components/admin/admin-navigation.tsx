"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { animatePanelEntrance } from "@/lib/ui/panel-motion";
import { useDialogFocus } from "@/lib/ui/use-dialog-focus";

import { getAdminNavBadgeCounts } from "@/lib/admin/nav-badges";

import {
   adminMoreItems,
   adminNavigationItems,
   adminPrimaryMobileItems,
   isAdminNavigationItemActive,
  type AdminNavBadgeCounts,
   type AdminNavigationId,
 } from "@/lib/ui/admin-navigation";

const badgeToneClasses: Record<"identity" | "reports", string> = {
  identity: "border-brand-yellow/30 bg-brand-yellow/15 text-warning",
  reports: "border-danger/25 bg-danger/10 text-danger",
};

function badgeForItem(
  id: AdminNavigationId,
  counts: AdminNavBadgeCounts | null,
) {
  if (!counts) return null;
  if (id === "identity" && counts.identityPending > 0) {
    return {
      count: counts.identityPending,
      tone: badgeToneClasses.identity,
      detail: "por revisar",
    };
  }
  if (id === "reports" && counts.openReports > 0) {
    return {
      count: counts.openReports,
      tone: badgeToneClasses.reports,
      detail: "abiertos",
    };
  }
  return null;
}
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
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "identity":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "providers":
      return (
        <svg {...common}>
          <path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2" />
          <path d="M8 7h8" />
          <path d="M2 12h20" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...common}>
          <path d="m7 7 10 10" />
          <path d="M6 3h5l10 10-8 8L3 11V6a3 3 0 0 1 3-3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <path d="M4 21V5a2 2 0 0 1 2-2h10l4 4v14" />
          <path d="M14 3v5h5" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
    case "jobs":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );
    case "payments":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h2" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      );
  }
}

export function AdminNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const motionRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const moreActive = adminMoreItems.some((item) =>
    isAdminNavigationItemActive(pathname, item.href),
  );
  const [badgeCounts, setBadgeCounts] =
    useState<AdminNavBadgeCounts | null>(null);

  useDialogFocus(moreOpen, dialogRef, closeRef, () => setMoreOpen(false));

  useEffect(() => {
    if (!moreOpen || !motionRef.current) return;
    return animatePanelEntrance(motionRef.current);
  }, [moreOpen]);
  useEffect(() => {
    let active = true;
    getAdminNavBadgeCounts()
      .then((counts) => {
        if (active) setBadgeCounts(counts);
      })
      .catch(() => {
        // Sin conteos la navegación sigue funcionando sin badges.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <aside className="admin-sidebar bg-canvas/95 border-ink/[0.06] fixed top-[4.5rem] bottom-0 left-0 z-30 hidden w-64 space-y-4 overflow-y-auto border-r p-4 backdrop-blur-xl lg:block">
        {(
          ["Principal", "Operación", "Personas", "Catálogo", "Sistema"] as const
        ).map((group) => {
          const items = adminNavigationItems.filter(
            (item) => item.navGroup === group,
          );
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-ink/60 px-3 pb-2 text-[11px] font-extrabold tracking-[0.18em] uppercase">
                {group}
              </p>
              <nav
                className="space-y-1"
                aria-label={`Administración: ${group}`}
              >
                {items.map((item) => {
                  const active = isAdminNavigationItemActive(
                    pathname,
                    item.href,
                  );
                  const badge = badgeForItem(item.id, badgeCounts);
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      aria-label={
                        badge
                          ? `${item.label}: ${badge.count} ${badge.detail}`
                          : undefined
                      }
                      className={`consumer-pressable flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
                        active
                          ? "border-transparent text-[#062433] shadow-[0_10px_24px_-8px_rgb(18_217_197/30%)]"
                          : "text-ink/70 hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                      style={
                        active
                          ? {
                              backgroundImage:
                                "linear-gradient(135deg, #08A9F4 0%, #12D9C5 65%, #65EC91 100%)",
                            }
                          : undefined
                      }
                      href={item.href}
                      key={item.id}
                    >
                      <NavIcon id={item.id} />
                      {item.label}
                      {badge ? (
                        <span
                          aria-hidden="true"
                          className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${badge.tone}`}
                        >
                          {badge.count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </aside>

      {moreOpen ? (
        <div
          ref={motionRef}
          className="fixed inset-0 z-50 lg:hidden"
          role="presentation"
        >
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            data-motion-backdrop
            onClick={() => setMoreOpen(false)}
            type="button"
          />
          <section
            ref={dialogRef}
            id="admin-more-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-more-menu-title"
            data-motion-panel
            className="mobile-safe-bottom border-ink/[0.08] bg-surface absolute right-0 bottom-0 left-0 rounded-t-[2rem] border-t px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="bg-ink/15 mx-auto mb-4 h-1 w-10 rounded-full" />
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-terracotta text-xs font-extrabold tracking-[0.14em] uppercase">
                  Administración
                </p>
                <h2
                  id="admin-more-menu-title"
                  className="text-ink mt-1 text-xl font-extrabold"
                >
                  Más herramientas
                </h2>
              </div>
              <button
                ref={closeRef}
                className="border-ink/[0.08] bg-surface text-ink/70 grid min-h-12 min-w-12 place-items-center rounded-2xl border"
                onClick={() => setMoreOpen(false)}
                type="button"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              {(["Operación", "Personas", "Catálogo", "Sistema"] as const).map(
                (group) => {
                  const items = adminMoreItems.filter(
                    (item) => item.navGroup === group,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="text-ink/60 px-1 pb-1.5 text-[11px] font-extrabold tracking-[0.16em] uppercase">
                        {group}
                      </p>
                      <nav
                        className="grid grid-cols-2 gap-2"
                        aria-label={group}
                      >
                        {items.map((item) => {
                          const active = isAdminNavigationItemActive(
                            pathname,
                            item.href,
                          );
                          const badge = badgeForItem(item.id, badgeCounts);
                          return (
                            <Link
                              aria-current={active ? "page" : undefined}
                              aria-label={
                                badge
                                  ? `${item.label}: ${badge.count} ${badge.detail}`
                                  : undefined
                              }
                              className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold ${
                                active
                                  ? "border-[#12D9C5]/30 bg-[#12D9C5]/10 text-[#12D9C5]"
                                  : "border-ink/[0.08] bg-surface text-ink"
                              }`}
                              href={item.href}
                              key={item.id}
                              onClick={() => setMoreOpen(false)}
                            >
                              <NavIcon id={item.id} />
                              {item.label}
                              {badge ? (
                                <span
                                  aria-hidden="true"
                                  className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${badge.tone}`}
                                >
                                  {badge.count}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                  );
                },
              )}
            </div>
          </section>
        </div>
      ) : null}

      <nav
        className="mobile-safe-bottom border-ink/[0.06] bg-canvas/95 fixed right-0 bottom-0 left-0 z-40 grid grid-cols-4 border-t px-2 pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden"
        aria-label="Administración móvil"
      >
        {adminPrimaryMobileItems.map((item) => {
          const active = isAdminNavigationItemActive(pathname, item.href);
          const badge = badgeForItem(item.id, badgeCounts);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              aria-label={
                badge
                  ? `${item.label}: ${badge.count} ${badge.detail}`
                  : undefined
              }
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-extrabold ${
                active ? "text-[#12D9C5]" : "text-ink/60"
              }`}
              href={item.href}
              key={item.id}
            >
              <NavIcon id={item.id} />
              {item.label}
              {badge ? (
                <span
                  aria-hidden="true"
                  className={`rounded-full border px-1.5 text-[10px] font-extrabold ${badge.tone}`}
                >
                  {badge.count}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          aria-expanded={moreOpen}
          aria-controls="admin-more-menu"
          aria-haspopup="dialog"
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-extrabold ${
            moreActive || moreOpen ? "text-[#12D9C5]" : "text-ink/60"
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
