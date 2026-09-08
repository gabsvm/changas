import Link from "next/link";

import { listMyUpcomingJobs } from "@/lib/jobs/server";
import { getJobStatusLabel } from "@/lib/ui/job-status";

function scheduleLabel(
  job: Awaited<ReturnType<typeof listMyUpcomingJobs>>[number],
) {
  if (job.starts_at) {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(job.starts_at));
  }
  if (job.deadline_at) {
    return `Entrega ${new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(job.deadline_at))}`;
  }
  return "A coordinar";
}

export default async function JobsPage() {
  const jobs = await listMyUpcomingJobs();

  return (
    <section className="py-7 sm:py-10">
      <header className="mb-6 max-w-3xl">
        <Link
          href="/activity"
          className="text-moss inline-flex min-h-12 items-center text-sm font-bold"
        >
          ← Actividad
        </Link>
        <p className="product-kicker mt-2">Trabajo protegido</p>
        <h1 className="product-page-title mt-2">Mis trabajos</h1>
        <p className="text-ink/60 mt-3 max-w-xl text-sm leading-6 sm:text-base">
          Seguí lo que está confirmado, en curso o esperando cierre desde una
          sola vista.
        </p>
      </header>

      {jobs.length === 0 ? (
        <section className="border-ink/10 bg-surface rounded-3xl border p-6 sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-[-0.025em]">
            Todavía no hay trabajos activos
          </h2>
          <p className="text-ink/60 mt-2 max-w-md text-sm leading-6">
            Cuando una propuesta quede aceptada y el pago correspondiente se
            confirme, vas a poder seguir la changa desde acá.
          </p>
          <Link href="/buscar" className="button-primary mt-5 inline-flex">
            Explorar servicios
          </Link>
        </section>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.job_id}
              href={`/jobs/${job.job_id}`}
              className="border-ink/10 bg-surface hover:border-brand-orange/35 block rounded-3xl border p-4 shadow-[0_10px_30px_rgba(32,33,36,0.04)] transition-colors sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{job.service_title}</p>
                  <p className="text-ink/55 mt-1 truncate text-sm">
                    {job.counterparty_name}
                  </p>
                </div>
                <span className="bg-brand-orange/10 text-terracotta rounded-full px-3 py-1 text-[11px] font-bold">
                  {getJobStatusLabel(job.job_status)}
                </span>
              </div>
              <div className="text-ink/55 mt-4 flex items-center justify-between gap-3 text-xs">
                <span>{scheduleLabel(job)}</span>
                <span className="text-moss font-bold" aria-hidden>
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
