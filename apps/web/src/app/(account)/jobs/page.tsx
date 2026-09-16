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
        <h1 className="mt-1.5 text-[24px] leading-7 font-extrabold tracking-[-0.03em]">
          Mis trabajos
        </h1>
        <p className="text-ink/60 mt-1.5 text-sm leading-6">
          Confirmados, en curso o pendientes de cierre.
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
          <div className="mt-5 grid gap-2.5">
            {jobs.map((job) => {
              const status = getJobStatusPresentation(job.job_status);
              return (
                <Link
                  key={job.job_id}
                  href={`/jobs/${job.job_id}`}
                  className="consumer-card consumer-card-pressed consumer-pressable flex min-h-[76px] items-center gap-3 p-3.5"
                >
                  <span className="bg-brand-orange/10 text-terracotta grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base font-extrabold">
                    {job.service_title.trim().charAt(0).toUpperCase() || "C"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">
                      {job.service_title}
                    </span>
                    <span className="text-ink/60 mt-0.5 block truncate text-[13px]">
                      {job.counterparty_name} · {scheduleLabel(job)}
                    </span>
                    <span className="mt-1.5 block">
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </span>
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="text-ink/50 h-5 w-5 shrink-0" fill="none">
                    <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
