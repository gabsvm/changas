import Link from "next/link";

import { listMyUpcomingJobs } from "@/lib/jobs/server";

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
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-moss text-xs font-bold tracking-[0.16em] uppercase">
          Trabajo protegido
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
          Mis trabajos
        </h1>
        <p className="text-ink/60 mt-2 max-w-xl text-sm leading-6">
          Acá aparecen los trabajos confirmados, en curso o pendientes de
          cierre.
        </p>
      </header>

      {jobs.length === 0 ? (
        <section className="border-ink/10 rounded-3xl border bg-white/70 p-6 text-center sm:p-10">
          <h2 className="font-display text-2xl font-semibold">
            Todavía no hay trabajos activos
          </h2>
          <p className="text-ink/60 mx-auto mt-2 max-w-md text-sm leading-6">
            Cuando una propuesta quede aceptada y el pago correspondiente se
            confirme, aparecerá acá.
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
              className="border-ink/10 hover:border-moss/30 block rounded-3xl border bg-white/75 p-4 shadow-[0_12px_40px_rgba(22,56,50,0.05)] transition sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{job.service_title}</p>
                  <p className="text-ink/55 mt-1 truncate text-sm">
                    {job.counterparty_name}
                  </p>
                </div>
                <span className="bg-moss/10 text-moss rounded-full px-3 py-1 text-[11px] font-bold">
                  {job.job_status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="text-ink/55 mt-4 flex items-center justify-between gap-3 text-xs">
                <span>{scheduleLabel(job)}</span>
                <span aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
