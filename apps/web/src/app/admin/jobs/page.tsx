import Link from "next/link";

import { resolveJobDisputeAction } from "@/app/admin/actions";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { adminRpc, type AdminJobRow } from "@/lib/admin/server";
import { getJobStatusPresentation } from "@/lib/ui/job-status";

const PAGE_SIZE = 100;

// DISPUTED primero: es la cola que exige decisión operativa inmediata.
// El resto sigue el orden del ciclo de vida del trabajo.
const JOB_STATUS_TABS = [
  "DISPUTED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETION_REQUESTED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "EXPIRED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

type JobStatusTab = (typeof JOB_STATUS_TABS)[number];

type SearchParams = { status?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

function parseStatus(value: string): JobStatusTab | null {
  const normalized = value.trim().toUpperCase();
  return (JOB_STATUS_TABS as readonly string[]).includes(normalized)
    ? (normalized as JobStatusTab)
    : null;
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selected = parseStatus(first(params.status));
  // Patrón de admin/reports: colas en paralelo. La lista filtrada sale del
  // RPC (cola completa) y los conteos de una sola lectura sin filtrar.
  const [jobs, recent] = await Promise.all([
    adminRpc<AdminJobRow[]>("list_admin_jobs", {
      requested_status: selected,
      search_text: null,
      page_size: PAGE_SIZE,
      page_offset: 0,
    }),
    selected
      ? adminRpc<AdminJobRow[]>("list_admin_jobs", {
          requested_status: null,
          search_text: null,
          page_size: PAGE_SIZE,
          page_offset: 0,
        })
      : Promise.resolve(null),
  ]);
  const scope = recent ?? jobs;
  const counts: Record<string, number> = {};
  for (const job of scope) {
    counts[job.status] = (counts[job.status] ?? 0) + 1;
  }
  const truncated = scope.length >= PAGE_SIZE;
  const selectedLabel = selected
    ? getJobStatusPresentation(selected).label
    : null;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Operación · Trabajos"
        title="Trabajos"
        description="Inspección rápida del estado de las contrataciones. Los datos sensibles siguen detrás de RPCs administrativos."
      />

      <nav
        aria-label="Filtrar trabajos por estado"
        className="flex flex-wrap gap-2"
      >
        <Link
          aria-current={selected === null ? "page" : undefined}
          className={`rounded-full border px-3 py-2 text-xs font-extrabold transition-colors ${
            selected === null
              ? "border-[#12D9C5]/40 bg-[#12D9C5]/15 text-ink"
              : "border-ink/[0.08] bg-surface text-ink/70 hover:text-ink"
          }`}
          href="/admin/jobs"
        >
          Todos · {scope.length}
        </Link>
        {JOB_STATUS_TABS.map((status) => {
          const active = selected === status;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-2 text-xs font-extrabold transition-colors ${
                active
                  ? "border-[#12D9C5]/40 bg-[#12D9C5]/15 text-ink"
                  : "border-ink/[0.08] bg-surface text-ink/70 hover:text-ink"
              }`}
              href={`/admin/jobs?status=${status}`}
              key={status}
            >
              {getJobStatusPresentation(status).label} ·{" "}
              {counts[status] ?? 0}
            </Link>
          );
        })}
      </nav>

      {truncated ? (
        <p className="border-ink/[0.08] bg-surface text-ink/70 rounded-2xl border px-4 py-3 text-xs leading-5">
          Mostramos hasta {PAGE_SIZE} trabajos recientes. Los conteos
          corresponden a esa ventana; la cola filtrada sale completa del
          servidor.
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink text-base font-extrabold">
            {selectedLabel ?? "Trabajos"}
          </h2>
          <span className="border-ink/[0.08] bg-surface text-ink/70 rounded-full border px-2.5 py-1 text-xs font-bold">
            {jobs.length}
          </span>
        </div>

        {jobs.length ? (
          <div className="grid min-w-0 gap-2 lg:grid-cols-2">
            {jobs.map((job) => {
              const presentation = getJobStatusPresentation(job.status);
              return (
                <article
                  className="border-ink/[0.08] bg-surface min-w-0 rounded-3xl border p-4"
                  key={job.job_id}
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-extrabold break-words">
                        {job.service_title}
                      </p>
                      <p className="text-ink/60 mt-1 text-[11px] break-all">
                        <Link
                          aria-label={`Ver seguimiento: ${job.service_title}`}
                          className="hover:underline"
                          href={`/jobs/${job.job_id}`}
                        >
                          {job.job_id}
                        </Link>
                      </p>
                    </div>
                    <div className="max-w-full min-w-0">
                      <AdminStatusBadge
                        label={presentation.label}
                        tone={
                          presentation.tone === "warning"
                            ? "pending"
                            : presentation.tone === "brand"
                              ? "pink"
                              : presentation.tone
                        }
                      />
                    </div>
                  </div>
                  <div className="border-ink/[0.08] bg-surface mt-4 grid min-w-0 gap-2 rounded-2xl border p-3 text-xs sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-ink/60 font-bold">Cliente</p>
                      <p className="text-ink mt-1 font-semibold break-all">
                        <Link
                          className="hover:underline"
                          href={`/admin/users?user=${job.client_user_id}`}
                        >
                          {job.client_display_name ?? job.client_user_id}
                        </Link>
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-ink/60 font-bold">Prestador</p>
                      <p className="text-ink mt-1 font-semibold break-all">
                        <Link
                          className="hover:underline"
                          href={`/admin/users?user=${job.provider_user_id}`}
                        >
                          {job.provider_display_name ?? job.provider_user_id}
                        </Link>
                      </p>
                    </div>
                  </div>
                  {job.status === "DISPUTED" ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["COMPLETED", "Completar"],
                          ["CANCELLED", "Cancelar"],
                        ] as const
                      ).map(([resolution, label]) => (
                        <form
                          key={resolution}
                          action={resolveJobDisputeAction}
                          className="border-ink/[0.08] bg-surface rounded-2xl border p-3"
                        >
                          <input
                            type="hidden"
                            name="jobId"
                            value={job.job_id}
                          />
                          <input
                            type="hidden"
                            name="resolution"
                            value={resolution}
                          />
                          <input
                            className="border-ink/10 text-ink w-full rounded-md border bg-white px-2 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                            name="reason"
                            required
                            minLength={2}
                            placeholder="Motivo de la resolución"
                          />
                          <button className="border-ink/[0.08] text-ink mt-2 w-full rounded-xl border px-2 py-2 text-sm font-extrabold">
                            {label}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <AdminEmptyState
            title={
              selectedLabel
                ? `Sin trabajos: ${selectedLabel}`
                : "No hay trabajos para mostrar"
            }
            description={
              selectedLabel
                ? "Cuando haya trabajos en este estado aparecen acá con su contexto operativo."
                : "Cuando existan contrataciones aparecerán acá con su estado operativo."
            }
          />
        )}
      </div>
    </section>
  );
}
