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
  [
    "/admin/providers",
    "Prestadores",
    "Perfiles, servicios y estado operativo.",
  ],
  ["/admin/catalog", "Catálogo", "Categorías, skills, tags y moderación."],
  ["/admin/reports", "Reportes", "Trust & Safety y resoluciones."],
  ["/admin/jobs", "Trabajos", "Estado y contexto de contrataciones."],
  ["/admin/payments", "Pagos", "Conciliación y desajustes financieros."],
  ["/admin/audit", "Auditoría", "Historial administrativo inmutable."],
] as const;

export default async function AdminPage() {
  const [identityQueue, openReports, providers, users, jobs] =
    await Promise.all([
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
  const disputedJobs = jobs.filter((job) => job.status === "DISPUTED");
  const hasAttention =
    identityQueue.length > 0 ||
    openReports.length > 0 ||
    incompleteProviders.length > 0 ||
    disputedJobs.length > 0;

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
          hint={`${providers.length} ${providers.length === 1 ? "perfil total" : "perfiles totales"}`}
          tone="success"
        />
        <AdminMetricCard
          label="Usuarios"
          value={users.length}
          hint={`${jobs.length} ${jobs.length === 1 ? "trabajo visible" : "trabajos visibles"}`}
          tone="info"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
              <p className="text-terracotta text-[11px] font-extrabold tracking-[0.14em] uppercase">
                Prioridad
              </p>
              <h2 className="font-display mt-1 text-lg font-extrabold text-ink">
                Necesita atención
              </h2>
          </div>
          {hasAttention ? (
            <span className="border-brand-orange/25 bg-brand-orange/10 text-terracotta rounded-full border px-2.5 py-1 text-xs font-extrabold">
              Acción requerida
            </span>
          ) : null}
        </div>

        {hasAttention ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {identityQueue.length ? (
              <Link
                className="border-brand-yellow/30 bg-brand-yellow/15 rounded-3xl border p-5 transition-colors"
                href="/admin/identity"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-warning text-sm font-extrabold">
                      Identidades por revisar
                    </p>
                    <p className="text-ink mt-2 text-3xl font-extrabold">
                      {identityQueue.length}
                    </p>
                  </div>
                  <span className="text-warning text-xl" aria-hidden="true">
                    →
                  </span>
                </div>
                <p className="text-ink/70 mt-3 text-xs leading-5">
                  Prestadores que ya enviaron documentación completa.
                </p>
              </Link>
            ) : null}

            {openReports.length ? (
              <Link
                className="border-danger/25 bg-danger/10 rounded-3xl border p-5 transition-colors"
                href="/admin/reports"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-danger text-sm font-extrabold">
                      Reportes abiertos
                    </p>
                    <p className="text-ink mt-2 text-3xl font-extrabold">
                      {openReports.length}
                    </p>
                  </div>
                  <span className="text-danger text-xl" aria-hidden="true">
                    →
                  </span>
                </div>
                <p className="text-ink/70 mt-3 text-xs leading-5">
                  Casos que todavía no tienen una resolución administrativa.
                </p>
              </Link>
            ) : null}

            {disputedJobs.length ? (
              <Link
                className="border-danger/25 bg-danger/10 rounded-3xl border p-5 transition-colors"
                href="/admin/jobs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-danger text-sm font-extrabold">
                      Disputas por resolver
                    </p>
                    <p className="text-ink mt-2 text-3xl font-extrabold">
                      {disputedJobs.length}
                    </p>
                  </div>
                  <span className="text-danger text-xl" aria-hidden="true">
                    →
                  </span>
                </div>
                <p className="text-ink/70 mt-3 text-xs leading-5">
                  Trabajos en disputa que esperan resolución con las partes.
                </p>
              </Link>
            ) : null}

            {incompleteProviders.length ? (
              <Link
                className="border-moss/25 bg-moss/10 rounded-3xl border p-5 transition-colors"
                href="/admin/providers"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-moss text-sm font-extrabold">
                      Onboarding incompleto
                    </p>
                    <p className="text-ink mt-2 text-3xl font-extrabold">
                      {incompleteProviders.length}
                    </p>
                  </div>
                  <span className="text-moss text-xl" aria-hidden="true">
                    →
                  </span>
                </div>
                <p className="text-ink/70 mt-3 text-xs leading-5">
                  Perfiles creados que todavía no enviaron identidad a revisión.
                </p>
              </Link>
            ) : null}
          </div>
        ) : (
          <AdminEmptyState
            title="Todo al día"
            description="No hay identidades, reportes, disputas ni onboardings pendientes que requieran una decisión inmediata."
          />
        )}
      </div>

      <AdminPanel>
        <div className="mb-4">
          <p className="text-ink/60 text-[11px] font-extrabold tracking-[0.14em] uppercase">
            Herramientas
          </p>
          <h2 className="font-display text-ink mt-1 text-lg font-extrabold">
            Administración completa
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(([href, title, description]) => (
            <Link
              className="border-ink/[0.08] hover:border-brand-orange/30 min-h-24 rounded-2xl border bg-white p-4 transition-colors dark:border-white/10 dark:bg-[#2a231c]"
              href={href}
              key={href}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-ink text-sm font-extrabold">
                  {title}
                </h3>
                <span className="text-ink/40" aria-hidden="true">
                  ↗
                </span>
              </div>
              <p className="text-ink/70 mt-2 text-xs leading-5">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}
