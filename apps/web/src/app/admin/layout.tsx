import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdminPage } from "@/lib/admin/server";

import "./admin.css";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPage();

  return (
    <div className="admin-shell bg-canvas text-ink min-h-dvh">
      <a className="skip-link" href="#admin-main">
        Ir al contenido
      </a>

      <header className="bg-canvas/90 border-ink/[0.06] sticky top-0 z-40 h-[4.5rem] border-b backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-7">
          <Link
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl"
            href="/admin"
            aria-label="YALO Administración"
          >
            <span
              className="brand-mark h-10 w-10 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-terracotta truncate text-[11px] font-extrabold tracking-[0.19em] uppercase">
                YALO
              </p>
              <p className="text-ink truncate text-sm font-extrabold tracking-[-0.01em]">
                Administración
              </p>
            </div>
          </Link>

          <div className="flex-1" />

          <Link
            className="border-ink/[0.08] bg-surface text-ink/70 hover:text-ink flex min-h-12 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors"
            href="/"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">Volver al sitio</span>
            <span className="sm:hidden">Sitio</span>
          </Link>
        </div>
      </header>

      <AdminNavigation />

      <main
        id="admin-main"
        className="admin-main min-h-[calc(100dvh-4.5rem)] px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-7 lg:ml-64 lg:px-8 lg:pb-12"
      >
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
