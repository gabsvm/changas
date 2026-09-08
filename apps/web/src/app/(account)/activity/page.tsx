import Link from "next/link";
import { redirect } from "next/navigation";

import { listMyUpcomingJobs } from "@/lib/jobs/server";
import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatusLabel } from "@/lib/ui/job-status";

export const dynamic = "force-dynamic";

function scheduleLabel(
  job: Awaited<ReturnType<typeof listMyUpcomingJobs>>[number],
): string {
  if (job.starts_at) {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(job.starts_at));
  }
  if (job.deadline_at) {
    return `Entrega ${new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
    }).format(new Date(job.deadline_at))}`;
  }
  return "A coordinar";
}

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/activity");

  const [jobs, unreadCount] = await Promise.all([
    listMyUpcomingJobs(),
    getUnreadNotificationCount(supabase),
  ]);
  const highlightedJobs = jobs.slice(0, 3);

  return (
    <section className="py-7 sm:py-10">
      <div className="max-w-3xl">
        <p className="product-kicker">Tu día en Changas</p>
        <h1 className="product-page-title mt-2">Actividad</h1>
        <p className="text-ink/60 mt-3 max-w-xl text-sm leading-6 sm:text-base">
          Seguí tus trabajos y enterate de lo importante sin mezclarlo con la
          configuración de notificaciones.
        </p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <Link
          href="/jobs"
          className="border-ink/10 bg-surface hover:border-brand-orange/35 group rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] transition-colors sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-terracotta text-xs font-extrabold">Trabajos</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.025em]">
                {jobs.length > 0
                  ? `${jobs.length} activo${jobs.length === 1 ? "" : "s"}`
                  : "Sin trabajos activos"}
              </h2>
            </div>
            <span
              className="bg-brand-orange/12 text-terracotta grid h-11 w-11 place-items-center rounded-2xl text-lg font-bold"
              aria-hidden="true"
            >
              ✓
            </span>
          </div>
          <p className="text-ink/60 mt-3 text-sm leading-6">
            Fechas, estado, coordinación y cierre de tus changas.
          </p>
          <span className="text-moss mt-5 inline-flex min-h-12 items-center text-sm font-extrabold group-hover:underline">
            Ver mis trabajos →
          </span>
        </Link>

        <Link
          href="/account/notifications"
          className="border-ink/10 bg-surface hover:border-moss/30 group rounded-3xl border p-5 shadow-[0_10px_30px_rgba(32,33,36,0.04)] transition-colors sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-moss text-xs font-extrabold">Notificaciones</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.025em]">
                {unreadCount > 0
                  ? `${unreadCount > 99 ? "99+" : unreadCount} sin leer`
                  : "Todo al día"}
              </h2>
            </div>
            <span
              className="bg-moss/8 text-moss grid h-11 w-11 place-items-center rounded-2xl text-lg font-bold"
              aria-hidden="true"
            >
              •
            </span>
          </div>
          <p className="text-ink/60 mt-3 text-sm leading-6">
            Cambios en propuestas, trabajos, mensajes y revisiones que requieren
            tu atención.
          </p>
          <span className="text-moss mt-5 inline-flex min-h-12 items-center text-sm font-extrabold group-hover:underline">
            Ver notificaciones →
          </span>
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="activity-next-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="product-kicker">Próximo</p>
            <h2 id="activity-next-title" className="product-section-title mt-1">
              Tus trabajos
            </h2>
          </div>
          {jobs.length > 3 ? (
            <Link className="text-moss text-sm font-bold" href="/jobs">
              Ver todos
            </Link>
          ) : null}
        </div>

        {highlightedJobs.length > 0 ? (
          <div className="border-ink/10 bg-surface mt-4 overflow-hidden rounded-3xl border">
            {highlightedJobs.map((job) => (
              <Link
                key={job.job_id}
                href={`/jobs/${job.job_id}`}
                className="border-ink/10 hover:bg-brand-yellow/8 flex min-h-20 items-center justify-between gap-4 border-b px-4 py-4 transition-colors last:border-b-0 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{job.service_title}</p>
                  <p className="text-ink/55 mt-1 truncate text-sm">
                    {job.counterparty_name} · {scheduleLabel(job)}
                  </p>
                </div>
                <span className="bg-brand-orange/10 text-terracotta shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                  {getJobStatusLabel(job.job_status)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-ink/10 bg-surface mt-4 rounded-3xl border p-6">
            <p className="font-extrabold">No tenés trabajos activos</p>
            <p className="text-ink/60 mt-2 text-sm leading-6">
              Cuando confirmes una changa, la vas a poder seguir desde acá.
            </p>
            <Link href="/buscar" className="button-primary mt-5">
              Explorar servicios
            </Link>
          </div>
        )}
      </section>
    </section>
  );
}
