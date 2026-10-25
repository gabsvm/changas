import { resolveJobDisputeAction } from "@/app/admin/actions";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { listAdminJobs } from "@/lib/admin/server";
import { getJobStatusPresentation } from "@/lib/ui/job-status";

export default async function AdminJobsPage() {
  const jobs = await listAdminJobs();
  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Operación · Trabajos"
        title="Trabajos"
        description="Inspección rápida del estado de las contrataciones. Los datos sensibles siguen detrás de RPCs administrativos."
      />
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
                      {job.job_id}
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
                      {job.client_display_name ?? job.client_user_id}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-ink/60 font-bold">Prestador</p>
                    <p className="text-ink mt-1 font-semibold break-all">
                      {job.provider_display_name ?? job.provider_user_id}
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
                        <input type="hidden" name="jobId" value={job.job_id} />
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
          title="No hay trabajos para mostrar"
          description="Cuando existan contrataciones aparecerán acá con su estado operativo."
        />
      )}
    </section>
  );
}
