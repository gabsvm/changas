import { listAdminJobs } from "@/lib/admin/server";

export default async function AdminJobsPage() {
  const jobs = await listAdminJobs();
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Trabajos</h2>
        <p className="text-sm text-slate-600">
          Inspección operativa acotada; los datos sensibles siguen detrás de
          RPCs admin.
        </p>
      </div>
      <div className="space-y-2">
        {jobs.length ? (
          jobs.map((job) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={job.job_id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{job.service_title}</p>
                  <p className="text-xs text-slate-500">{job.job_id}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                  {job.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Cliente: {job.client_display_name ?? job.client_user_id} ·
                Prestador: {job.provider_display_name ?? job.provider_user_id}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No hay trabajos para mostrar.
          </p>
        )}
      </div>
    </section>
  );
}
