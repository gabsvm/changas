import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdminPage } from "@/lib/admin/server";

const navigation = [
  ["/admin", "Resumen"],
  ["/admin/users", "Usuarios"],
  ["/admin/providers", "Prestadores"],
  ["/admin/identity", "Identidad"],
  ["/admin/catalog", "Catálogo"],
  ["/admin/reports", "Reportes"],
  ["/admin/jobs", "Trabajos"],
  ["/admin/audit", "Auditoría"],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Changas</p>
              <h1 className="text-xl font-bold">Administración</h1>
            </div>
            <Link className="text-sm font-semibold text-slate-600 hover:text-slate-950" href="/">
              Volver al sitio
            </Link>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Administración">
            {navigation.map(([href, label]) => (
              <Link
                className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100"
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
