import Link from "next/link";

import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { listAdminIdentityQueue } from "@/lib/admin/identity";
import {
  listAdminJobs,
  listAdminProviders,
  listAdminReports,
  listAdminUsers,
} from "@/lib/admin/server";

const tools = [
  ["/admin/providers", "Prestadores", "Perfiles, servicios y estado operativo."],
  ["/admin/catalog", "Catálogo", "Categorías, skills, tags y moderación."],
  ["/admin/reports", "Reportes", "Trust & Safety y resoluciones."],
  ["/admin/jobs", "Trabajos", "Estado y contexto de contrataciones."],
  ["/admin/payments", "Pagos", "Conciliación y desajustes financieros."],
  ["/admin/audit", "Auditoría", "Historial administrativo inmutable."],
] as const;

export default async function AdminPage() {
  const [identityQueue, openReports, providers, users, jobs] = await Promise.all([
    listAdminIdentityQueue(),
    listAdminReports("OPEN"),
    listAdminProviders(),
    listAdminUsers(),
    listAdminJobs(),
  ]);

  const incompleteProviders = providers.filter(
    (provider) => provider.status === "PROFILE_INCOMPLETE",
  );
  const activeProviders = providers.filter(
    (provider) => provider.status === "ACTIVE",
  );
  const hasAttention =
    identityQueue.length > 0 ||
    openReports.length > 0 ||
    incompleteProviders.length > 0;

  return (
    <section className="space-y-7">
      <AdminPageHeader
        eyebrow="Centro de operaciones"
        title="Resumen"
        description="Primero lo que necesita una decisión. Después, el resto de la operación."
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AdminMetricCard
          label="Identidades pendientes"
          value={identityQueue.length}
          hint="Revisión manual"
          tone={identityQueue.length ? "pending" : "success"}
        />
        <AdminMetricCard
          label="Reportes abiertos"
          value={openReports.length}
          hint="Trust & Safety"
          tone={openReports.length ? "danger" : "success"}
        />
        <AdminMetricCard
          label="Prestadores activos"
          value={activeProviders.length}
          hint={`${providers.length} perfiles totales`}
          tone="success"
        />
        <AdminMetricCard
          label="Usuarios"
          value={users.length}
          hint={`${jobs.length} trabajos visibles`}
          tone="info"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-extrabold tracking-[0.14em] text-[#ff7b4c] uppercase">
              Prioridad
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-white">Necesita atención</h2>
          </div>
          {hasAttention ? (
            <span className="rounded-full border border-[#d60060]/30 bg-[#d60060]/12 px-2.5 py-1 text-xs font-extrabold text-[#ff79ad]">
              Acción requerida
            </span>
          ) : null}
        </div>

        {hasAttention ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {identityQueue.length ? (
              <Link
                className="rounded-[1.6rem] border border-[#ffc857]/30 bg-[#ffc857]/10 p-5 transition-colors hover:bg-[#ffc857]/14"
                href="/admin/identity"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#ffd878]">Identidades por revisar</p>
                    <p className="mt-2 text-3xl font-extrabold text-white">{identityQueue.length}</p>
                  </div>
                  <span className="text-xl text-[#ffd878]" aria-hidden="true">→</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#b6a479]">
                  Prestadores que ya enviaron documentación completa.
                </p>
              </Link>
            ) : null}

            {openReports.length ? (
              <Link
                className="rounded-[1.6rem] border border-[#ef5350]/30 bg-[#ef5350]/9 p-5 transition-colors hover:bg-[#ef5350]/13"
                href="/admin/reports"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#ff7774]">Reportes abiertos</p>
                    <p className="mt-2 text-3xl font-extrabold text-white">{openReports.length}</p>
                  </div>
                  <span className="text-xl text-[#ff7774]" aria-hidden="true">→</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#a98080]">
                  Casos que todavía no tienen una resolución administrativa.
                </p>
              </Link>
            ) : null}

            {incompleteProviders.length ? (
              <Link
                className="rounded-[1.6rem] border border-[#4f7dff]/30 bg-[#2563eb]/10 p-5 transition-colors hover:bg-[#2563eb]/14"
                href="/admin/providers"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#7ea2ff]">Onboarding incompleto</p>
                    <p className="mt-2 text-3xl font-extrabold text-white">{incompleteProviders.length}</p>
                  </div>
                  <span className="text-xl text-[#7ea2ff]" aria-hidden="true">→</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#8192bb]">
                  Perfiles creados que todavía no enviaron identidad a revisión.
                </p>
              </Link>
            ) : null}
          </div>
        ) : (
          <AdminEmptyState
            title="Todo al día"
            description="No hay identidades, reportes ni onboardings pendientes que requieran una decisión inmediata."
          />
        )}
      </div>

      <AdminPanel>
        <div className="mb-4">
          <p className="text-[0.68rem] font-extrabold tracking-[0.14em] text-[#697386] uppercase">
            Herramientas
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-white">Administración completa</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(([href, title, description]) => (
            <Link
              className="min-h-24 rounded-2xl border border-[#273142] bg-[#101720] p-4 transition-colors hover:border-[#3a4659] hover:bg-[#17202c]"
              href={href}
              key={href}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-extrabold text-[#e4e7ec]">{title}</h3>
                <span className="text-[#596579]" aria-hidden="true">↗</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#7f8a9b]">{description}</p>
            </Link>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}
