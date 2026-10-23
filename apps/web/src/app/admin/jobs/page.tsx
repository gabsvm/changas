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
              className="min-w-0 rounded-3xl border border-ink/[0.08] bg-surface p-4"
              key={job.job_id}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-extrabold text-ink">
                    {job.service_title}
                  </p>
                  <p className="mt-1 break-all text-[11px] text-ink/60">
                    {job.job_id}
                  </p>
                </div>
                <div className="min-w-0 max-w-full">
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
              <div className="mt-4 grid min-w-0 gap-2 rounded-2xl border border-ink/[0.08] bg-surface p-3 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink/60">Cliente</p>
                  <p className="mt-1 break-all font-semibold text-ink">
                    {job.client_display_name ?? job.client_user_id}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-ink/60">Prestador</p>
                  <p className="mt-1 break-all font-semibold text-ink">
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
                      className="rounded-2xl border border-ink/[0.08] bg-surface p-3"
                    >
                      <input type="hidden" name="jobId" value={job.job_id} />
                      <input
                        type="hidden"
                        name="resolution"
                        value={resolution}
                      />
                      <input
                        className="w-full rounded-md border border-ink/10 bg-white px-2 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                        name="reason"
                        required
                        minLength={2}
                        placeholder="Motivo de la resolución"
                      />
                      <button className="mt-2 w-full rounded-xl border border-ink/[0.08] px-2 py-2 text-sm font-extrabold text-ink">
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
