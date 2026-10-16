import {
  resolveReportAction,
  setMessageModerationAction,
  setReviewModerationAction,
} from "@/app/admin/actions";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { listAdminReports } from "@/lib/admin/server";

function reportTypeLabel(type: string) {
  return type === "REVIEW_REPORT" ? "Reseña" : "Conversación";
}

export default async function AdminReportsPage() {
  const [openReports, resolvedReports] = await Promise.all([
    listAdminReports("OPEN"),
    listAdminReports("RESOLVED"),
  ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Operación · Reportes"
        title="Reportes"
        description="Casos abiertos primero, decisiones reversibles y evidencia preservada sin borrado destructivo."
        action={
          <div className="border-danger/25 bg-danger/10 rounded-2xl border px-4 py-3 text-center">
            <p className="text-danger text-2xl font-extrabold">
              {openReports.length}
            </p>
            <p className="text-danger text-[11px] font-extrabold tracking-[0.08em] uppercase">
              abiertos
            </p>
          </div>
        }
      />

      <AdminPanel>
        <details>
          <summary className="text-ink cursor-pointer text-sm font-extrabold">
            Moderación puntual de mensaje
          </summary>
          <p className="text-ink/70 mt-2 text-xs leading-5">
            Usá esta herramienta cuando ya tengas el UUID exacto del mensaje y
            un motivo de política.
          </p>
          <form
            action={setMessageModerationAction}
            className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_auto]"
          >
            <input
              className="border-ink/10 text-ink min-w-0 rounded-lg border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
              name="messageId"
              required
              placeholder="UUID del mensaje"
              aria-label="UUID del mensaje"
            />
            <input
              className="border-ink/10 text-ink min-w-0 rounded-lg border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
              name="reason"
              required
              minLength={2}
              placeholder="Motivo de política"
              aria-label="Motivo de política"
            />
            <input type="hidden" name="disposition" value="HIDDEN_POLICY" />
            <button className="bg-danger min-h-12 rounded-2xl px-4 py-3 text-sm font-extrabold text-white">
              Ocultar mensaje
            </button>
          </form>
        </details>
      </AdminPanel>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink text-base font-extrabold">
            Necesitan decisión
          </h2>
          <AdminStatusBadge
            label={`${openReports.length} pendientes`}
            tone={openReports.length ? "danger" : "success"}
          />
        </div>

        {openReports.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {openReports.map((report) => (
              <article
                className="border-ink/[0.08] bg-surface rounded-3xl border p-4 sm:p-5"
                key={`${report.report_type}-${report.report_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge
                        label={reportTypeLabel(report.report_type)}
                        tone="info"
                      />
                      <AdminStatusBadge label="Abierto" tone="danger" />
                    </div>
                    <h3 className="text-ink mt-3 text-base font-extrabold">
                      {report.category}
                    </h3>
                    <p className="text-ink/60 mt-1 text-[11px] break-all">
                      Caso {report.report_id}
                    </p>
                  </div>
                </div>

                {report.reason ? (
                  <p className="border-ink/[0.08] bg-surface text-ink mt-4 rounded-2xl border p-3 text-sm leading-6">
                    {report.reason}
                  </p>
                ) : null}

                {report.report_type === "REVIEW_REPORT" ? (
                  <details className="border-ink/[0.08] bg-surface mt-4 rounded-2xl border p-3">
                    <summary className="text-ink cursor-pointer text-sm font-extrabold">
                      Moderar reseña reportada
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <form action={setReviewModerationAction}>
                        <input
                          type="hidden"
                          name="reviewId"
                          value={report.target_id}
                        />
                        <input
                          type="hidden"
                          name="disposition"
                          value="HIDDEN_POLICY"
                        />
                        <input
                          className="border-ink/10 text-ink w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                          name="reason"
                          required
                          minLength={2}
                          placeholder="Motivo de ocultación"
                        />
                        <button className="bg-danger mt-2 min-h-12 w-full rounded-2xl px-3 py-2 text-sm font-extrabold text-white">
                          Ocultar reseña
                        </button>
                      </form>
                      <form action={setReviewModerationAction}>
                        <input
                          type="hidden"
                          name="reviewId"
                          value={report.target_id}
                        />
                        <input
                          type="hidden"
                          name="disposition"
                          value="RESTORED"
                        />
                        <input
                          className="border-ink/10 text-ink w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                          name="reason"
                          placeholder="Nota de restauración"
                        />
                        <button className="border-ink/[0.08] text-ink mt-2 min-h-12 w-full rounded-2xl border px-3 py-2 text-sm font-extrabold">
                          Restaurar reseña
                        </button>
                      </form>
                    </div>
                  </details>
                ) : null}

                <form action={resolveReportAction} className="mt-4 space-y-2">
                  <input
                    type="hidden"
                    name="reportType"
                    value={report.report_type}
                  />
                  <input
                    type="hidden"
                    name="reportId"
                    value={report.report_id}
                  />
                  <label className="text-ink/70 block text-xs font-bold">
                    Resolución del caso
                    <textarea
                      className="border-ink/10 text-ink mt-1 min-h-24 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                      name="resolution"
                      required
                      minLength={2}
                      maxLength={2000}
                      placeholder="Resolución del caso"
                    />
                  </label>
                  <button className="min-h-12 w-full rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
                    Resolver reporte
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="No hay reportes abiertos"
            description="Cuando llegue un caso aparecerá acá antes del historial."
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink text-base font-extrabold">
            Historial resuelto
          </h2>
          <span className="text-ink/60 text-xs font-bold">
            {resolvedReports.length} casos
          </span>
        </div>
        {resolvedReports.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {resolvedReports.map((report) => (
              <article
                className="border-ink/[0.08] bg-surface rounded-3xl border p-4"
                key={`${report.report_type}-${report.report_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-extrabold">
                      {report.category}
                    </p>
                    <p className="text-ink/70 mt-1 text-xs leading-5">
                      {report.resolution ?? "Resuelto"}
                    </p>
                  </div>
                  <AdminStatusBadge label="Resuelto" tone="success" />
                </div>
                <p className="text-ink/60 mt-3 text-[11px] break-all">
                  {reportTypeLabel(report.report_type)} · {report.report_id}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="Todavía no hay historial"
            description="Los casos resueltos se conservarán acá para trazabilidad."
          />
        )}
      </div>
    </section>
  );
}
