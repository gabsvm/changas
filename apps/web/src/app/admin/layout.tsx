import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdminPage } from "@/lib/admin/server";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPage();

  return (
    <div className="admin-shell min-h-dvh bg-[#0b1018] text-white">
      <a className="skip-link" href="#admin-main">
        Ir al contenido
      </a>

      <header className="sticky top-0 z-40 h-[4.5rem] border-b border-[#273142] bg-[#0b1018]/92 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-7">
          <Link
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl"
            href="/admin"
            aria-label="Changas Administración"
          >
            <span className="brand-mark h-10 w-10 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-[0.62rem] font-extrabold tracking-[0.19em] text-[#ff7b4c] uppercase">
                Changas
              </p>
              <p className="truncate text-sm font-extrabold tracking-[-0.01em] text-white">
                Administración
              </p>
            </div>
          </Link>

          <div className="flex-1" />

          <Link
            className="flex min-h-11 items-center gap-2 rounded-xl border border-[#273142] bg-[#121923] px-3 text-xs font-bold text-[#98a2b3] transition-colors hover:border-[#3a4659] hover:text-white"
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
