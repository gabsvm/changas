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
        eyebrow="Trust & Safety"
        title="Reportes"
        description="Casos abiertos primero, decisiones reversibles y evidencia preservada sin borrado destructivo."
        action={
          <div className="rounded-2xl border border-[#ef5350]/30 bg-[#ef5350]/10 px-4 py-3 text-center">
            <p className="text-2xl font-extrabold text-[#ff7774]">{openReports.length}</p>
            <p className="text-[0.65rem] font-extrabold tracking-[0.08em] text-[#a98080] uppercase">
              abiertos
            </p>
          </div>
        }
      />

      <AdminPanel>
        <details>
          <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
            Moderación puntual de mensaje
          </summary>
          <p className="mt-2 text-xs leading-5 text-[#7f8a9b]">
            Usá esta herramienta cuando ya tengas el UUID exacto del mensaje y un motivo de política.
          </p>
          <form
            action={setMessageModerationAction}
            className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_auto]"
          >
            <input
              className="min-w-0 px-3 py-2 text-sm"
              name="messageId"
              required
              placeholder="UUID del mensaje"
              aria-label="UUID del mensaje"
            />
            <input
              className="min-w-0 px-3 py-2 text-sm"
              name="reason"
              required
              minLength={2}
              placeholder="Motivo de política"
              aria-label="Motivo de política"
            />
            <input type="hidden" name="disposition" value="HIDDEN_POLICY" />
            <button className="min-h-12 rounded-2xl bg-[#ef5350] px-4 py-3 text-sm font-extrabold text-white">
              Ocultar mensaje
            </button>
          </form>
        </details>
      </AdminPanel>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-white">Necesitan decisión</h2>
          <AdminStatusBadge
            label={`${openReports.length} pendientes`}
            tone={openReports.length ? "danger" : "success"}
          />
        </div>

        {openReports.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {openReports.map((report) => (
              <article
                className="rounded-[1.5rem] border border-[#273142] bg-[#151c27] p-4 sm:p-5"
                key={`${report.report_type}-${report.report_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge label={reportTypeLabel(report.report_type)} tone="info" />
                      <AdminStatusBadge label="Abierto" tone="danger" />
                    </div>
                    <h3 className="mt-3 text-base font-extrabold text-white">
                      {report.category}
                    </h3>
                    <p className="mt-1 break-all text-[0.68rem] text-[#697386]">
                      Caso {report.report_id}
                    </p>
                  </div>
                </div>

                {report.reason ? (
                  <p className="mt-4 rounded-2xl border border-[#273142] bg-[#101720] p-3 text-sm leading-6 text-[#c5cbd4]">
                    {report.reason}
                  </p>
                ) : null}

                {report.report_type === "REVIEW_REPORT" ? (
                  <details className="mt-4 rounded-2xl border border-[#273142] bg-[#101720] p-3">
                    <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
                      Moderar reseña reportada
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <form action={setReviewModerationAction}>
                        <input type="hidden" name="reviewId" value={report.target_id} />
                        <input type="hidden" name="disposition" value="HIDDEN_POLICY" />
                        <input
                          className="w-full px-3 py-2 text-sm"
                          name="reason"
                          required
                          minLength={2}
                          placeholder="Motivo de ocultación"
                        />
                        <button className="mt-2 min-h-12 w-full rounded-2xl bg-[#ef5350] px-3 py-2 text-sm font-extrabold text-white">
                          Ocultar reseña
                        </button>
                      </form>
                      <form action={setReviewModerationAction}>
                        <input type="hidden" name="reviewId" value={report.target_id} />
                        <input type="hidden" name="disposition" value="RESTORED" />
                        <input
                          className="w-full px-3 py-2 text-sm"
                          name="reason"
                          placeholder="Nota de restauración"
                        />
                        <button className="mt-2 min-h-12 w-full rounded-2xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                          Restaurar reseña
                        </button>
                      </form>
                    </div>
                  </details>
                ) : null}

                <form action={resolveReportAction} className="mt-4 space-y-2">
                  <input type="hidden" name="reportType" value={report.report_type} />
                  <input type="hidden" name="reportId" value={report.report_id} />
                  <label className="block text-xs font-bold text-[#8f99aa]">
                    Resolución del caso
                    <textarea
                      className="mt-1 min-h-24 w-full px-3 py-2 text-sm"
                      name="resolution"
                      required
                      minLength={2}
                      maxLength={2000}
                      placeholder="Resolución del caso"
                    />
                  </label>
                  <button className="min-h-12 w-full rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
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
          <h2 className="text-base font-extrabold text-white">Historial resuelto</h2>
          <span className="text-xs font-bold text-[#697386]">{resolvedReports.length} casos</span>
        </div>
        {resolvedReports.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {resolvedReports.map((report) => (
              <article
                className="rounded-[1.35rem] border border-[#273142] bg-[#151c27] p-4"
                key={`${report.report_type}-${report.report_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white">{report.category}</p>
                    <p className="mt-1 text-xs leading-5 text-[#98a2b3]">
                      {report.resolution ?? "Resuelto"}
                    </p>
                  </div>
                  <AdminStatusBadge label="Resuelto" tone="success" />
                </div>
                <p className="mt-3 break-all text-[0.65rem] text-[#697386]">
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
