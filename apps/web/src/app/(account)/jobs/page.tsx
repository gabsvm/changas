import Link from "next/link";

import { formatMinorUnits } from "@changas/domain";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import {
  listMyPastJobs,
  listMyUpcomingJobs,
  type UpcomingJob,
} from "@/lib/jobs/server";
import { getJobStatusPresentation } from "@/lib/ui/job-status";

function scheduleLabel(job: UpcomingJob) {
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

function nextAction(job: UpcomingJob): string | null {
  if (job.is_client === false && job.job_status === "CONFIRMED")
    return "Iniciar trabajo";
  if (job.is_client === false && job.job_status === "IN_PROGRESS")
    return "Solicitar finalización";
  if (job.is_client === true && job.job_status === "COMPLETION_REQUESTED")
    return "Confirmar finalización";
  return null;
}

function jobAmount(job: UpcomingJob): string | null {
  const total = job.total_price_amount ?? job.base_price_amount;
  if (total === null || !job.currency_code) return null;
  return formatMinorUnits(total, job.currency_code);
}

function hasPaidExtras(job: UpcomingJob): boolean {
  return job.paid_additional_amount !== null && job.paid_additional_amount > 0;
}

function settlementLabel(job: UpcomingJob): string | null {
  if (job.settlement_status === "DUE")
    return job.is_client ? "Pendiente de pago" : "Pendiente de cobro";
  if (job.settlement_status === "SETTLED") return "Pagado";
  return null;
}

const statusFilters = [
  { key: "all", label: "Todos" },
  { key: "confirmed", label: "Confirmados" },
  { key: "in_progress", label: "En curso" },
  { key: "closing", label: "Por cerrar" },
  { key: "history", label: "Historial" },
] as const;

type StatusFilter = (typeof statusFilters)[number]["key"];

function matchesFilter(job: UpcomingJob, filter: StatusFilter): boolean {
  switch (filter) {
    case "confirmed":
      return job.job_status === "CONFIRMED";
    case "in_progress":
      return job.job_status === "IN_PROGRESS";
    case "closing":
      return (
        job.job_status === "COMPLETION_REQUESTED" ||
        job.job_status === "DISPUTED"
      );
    case "history":
      return true;
    default:
      return true;
  }
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = params.status;
  const activeFilter: StatusFilter = statusFilters.some(
    (option) =>
      option.key === (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus),
  )
    ? ((Array.isArray(rawStatus) ? rawStatus[0] : rawStatus) as StatusFilter)
    : "all";
  const jobs =
    activeFilter === "history"
      ? await listMyPastJobs()
      : await listMyUpcomingJobs();
  const visible = jobs.filter((job) => matchesFilter(job, activeFilter));

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Mis trabajos" backHref="/account" />
      <div className="mx-auto max-w-3xl pt-5 sm:pt-0">
        <h1 className="mt-1.5 text-[24px] leading-8 font-extrabold tracking-[-0.03em]">
          Mis trabajos
        </h1>
        <p className="text-ink/70 mt-1.5 max-w-md text-sm leading-6">
          Tus contrataciones activas e historial.
        </p>

        <nav
          className="mt-4 flex gap-2 overflow-x-auto"
          aria-label="Filtrar trabajos"
        >
          {statusFilters.map((option) => {
            const active = option.key === activeFilter;
            return (
              <Link
                key={option.key}
                href={
                  option.key === "all" ? "/jobs" : `/jobs?status=${option.key}`
                }
                aria-current={active ? "page" : undefined}
                className={`consumer-pressable inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-bold ${
                  active
                    ? "text-white shadow-[0_8px_20px_-8px_rgb(238_90_36/60%)] dark:shadow-[0_8px_20px_-8px_rgb(0_0_0/70%)]"
                    : "bg-surface border-ink/[0.08] border"
                }`}
                style={
                  active
                    ? {
                        backgroundImage:
                          "linear-gradient(135deg, #FF9A3D 0%, #EE5A24 100%)",
                      }
                    : undefined
                }
              >
                {option.label}
              </Link>
            );
          })}
        </nav>

        {jobs.length === 0 ? (
          activeFilter === "history" ? (
            <EmptyState
              title="Sin trabajos anteriores"
              description="Cuando completes, canceles o registres ausencias, van a aparecer acá."
              actionHref="/buscar"
              actionLabel="Explorar servicios"
              className="pt-14"
            />
          ) : (
            <EmptyState
              title="Todavía no hay trabajos activos"
              description="Cuando aceptes o te acepten una propuesta, el trabajo aparecerá acá."
              actionHref="/buscar"
              actionLabel="Explorar servicios"
              className="pt-14"
            />
          )
        ) : visible.length === 0 ? (
          <EmptyState
            title="Sin trabajos en este estado"
            description="Probá con otro filtro para ver el resto de tus trabajos."
            actionHref="/jobs"
            actionLabel="Ver todos"
            actionTone="secondary"
            className="pt-14"
          />
        ) : (
          <div className="mt-5 grid gap-3">
            {visible.map((job) => {
              const status = getJobStatusPresentation(job.job_status);
              const amount = jobAmount(job);
              const action = nextAction(job);
              return (
                <Link
                  key={job.job_id}
                  href={`/jobs/${job.job_id}`}
                  className="consumer-card consumer-card-pressed consumer-pressable group bg-surface flex min-h-[76px] items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span
                    className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-base font-extrabold text-white shadow-[0_8px_20px_-8px_rgb(23_20_15/35%)] dark:shadow-[0_8px_20px_-8px_rgb(0_0_0/70%)]"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #F5B942 0%, #DE7E1F 100%)",
                    }}
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-0 opacity-25"
                      style={{
                        backgroundImage:
                          "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                        backgroundSize: "10px 10px",
                      }}
                    />
                    <span className="relative drop-shadow-[0_2px_6px_rgb(0_0_0/25%)]">
                      {job.service_title.trim().charAt(0).toUpperCase() || "C"}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] leading-6 font-bold">
                      {job.service_title}
                    </span>
                    <span className="text-ink/70 mt-1 block truncate text-[13px]">
                      {job.counterparty_name} · {scheduleLabel(job)}
                    </span>
                    <span className="mt-1.5 block">
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </span>
                  </span>
                  {amount || action ? (
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {amount ? (
                        <span className="text-[15px] font-extrabold">
                          {amount}
                        </span>
                      ) : null}
                      {hasPaidExtras(job) ? (
                        <span className="text-ink/60 text-[11px] font-semibold">
                          incluye adicionales
                        </span>
                      ) : null}
                      {settlementLabel(job) ? (
                        <span className="text-ink/60 text-[11px] font-semibold">
                          {settlementLabel(job)}
                        </span>
                      ) : null}
                      {action ? (
                        <span className="text-terracotta text-xs font-bold">
                          {action}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="text-ink/70 h-5 w-5 shrink-0"
                      fill="none"
                    >
                      <path
                        d="m9 5 7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
