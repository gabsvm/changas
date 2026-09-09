import Link from "next/link";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { listMyUpcomingJobs } from "@/lib/jobs/server";
import { getJobStatusPresentation } from "@/lib/ui/job-status";

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
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Mis trabajos" backHref="/account" />
      <div className="mx-auto max-w-3xl pt-5 sm:pt-0">
        <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          Actividad
        </p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
          Mis trabajos
        </h1>
        <p className="text-ink/55 mt-1.5 text-sm leading-6">
          Trabajos confirmados, en curso o pendientes de cierre.
        </p>

        {jobs.length === 0 ? (
          <EmptyState
            title="Todavía no hay trabajos activos"
            description="Cuando una propuesta quede aceptada y el pago correspondiente se confirme, aparecerá acá."
            actionHref="/buscar"
            actionLabel="Explorar servicios"
            className="pt-14"
          />
        ) : (
          <div className="border-ink/10 mt-5 divide-y divide-ink/10 border-y">
            {jobs.map((job) => {
              const status = getJobStatusPresentation(job.job_status);
              return (
                <Link
                  key={job.job_id}
                  href={`/jobs/${job.job_id}`}
                  className="consumer-pressable flex min-h-[4.75rem] items-center gap-3 rounded-lg px-1 py-3 hover:bg-ink/[0.035]"
                >
                  <span className="bg-brand-orange/10 text-terracotta grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold">
                    {job.service_title.trim().charAt(0).toUpperCase() || "C"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {job.service_title}
                    </span>
                    <span className="text-ink/52 mt-0.5 block truncate text-sm">
                      {job.counterparty_name}
                    </span>
                    <span className="text-ink/38 mt-0.5 block truncate text-xs">
                      {scheduleLabel(job)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    <span className="text-ink/25 text-xl" aria-hidden="true">
                      ›
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
