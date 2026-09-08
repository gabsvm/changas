import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { listAdminJobs } from "@/lib/admin/server";

export default async function AdminJobsPage() {
  const jobs = await listAdminJobs();
  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Operación"
        title="Trabajos"
        description="Inspección rápida del estado de las contrataciones. Los datos sensibles siguen detrás de RPCs administrativos."
      />
      {jobs.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {jobs.map((job) => (
            <article
              className="rounded-[1.4rem] border border-[#273142] bg-[#151c27] p-4"
              key={job.job_id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-white">
                    {job.service_title}
                  </p>
                  <p className="mt-1 truncate text-[0.68rem] text-[#697386]">
                    {job.job_id}
                  </p>
                </div>
                <AdminStatusBadge label={job.status} tone="info" />
              </div>
              <div className="mt-4 grid gap-2 rounded-2xl border border-[#273142] bg-[#101720] p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-bold text-[#697386]">Cliente</p>
                  <p className="mt-1 truncate font-semibold text-[#d0d5dd]">
                    {job.client_display_name ?? job.client_user_id}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-[#697386]">Prestador</p>
                  <p className="mt-1 truncate font-semibold text-[#d0d5dd]">
                    {job.provider_display_name ?? job.provider_user_id}
                  </p>
                </div>
              </div>
            </article>
          ))}
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
