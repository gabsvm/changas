import {
  resolveReportAction,
  setMessageModerationAction,
  setReviewModerationAction,
} from "@/app/admin/actions";
import { listAdminReports } from "@/lib/admin/server";

export default async function AdminReportsPage() {
  const [openReports, resolvedReports] = await Promise.all([
    listAdminReports("OPEN"),
    listAdminReports("RESOLVED"),
  ]);

  return (
    <section className="space-y-8">
      <div><h2 className="text-2xl font-bold">Trust & Safety</h2><p className="text-sm text-slate-600">Reportes preservados, decisiones reversibles y evidencia sin borrado destructivo.</p></div>
      <form action={setMessageModerationAction} className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold">Moderación puntual de mensaje</h3><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input className="rounded-lg border border-slate-300 px-3 py-2" name="messageId" required placeholder="UUID del mensaje" /><input className="rounded-lg border border-slate-300 px-3 py-2" name="reason" required minLength={2} placeholder="Motivo de política" /><input type="hidden" name="disposition" value="HIDDEN_POLICY" /><button className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white">Ocultar</button></div></form>
      <div><h3 className="mb-3 text-lg font-bold">Reportes abiertos</h3><div className="space-y-3">{openReports.length ? openReports.map((report) => <article className="rounded-2xl border border-slate-200 bg-white p-4" key={`${report.report_type}-${report.report_id}`}><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold">{report.category}</p><p className="text-xs text-slate-500">{report.report_type} · {report.report_id}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">OPEN</span></div>{report.reason ? <p className="mt-3 text-sm text-slate-700">{report.reason}</p> : null}{report.report_type === "REVIEW_REPORT" ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><form action={setReviewModerationAction}><input type="hidden" name="reviewId" value={report.target_id} /><input type="hidden" name="disposition" value="HIDDEN_POLICY" /><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="reason" required minLength={2} placeholder="Motivo de ocultación" /><button className="mt-2 w-full rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">Ocultar review</button></form><form action={setReviewModerationAction}><input type="hidden" name="reviewId" value={report.target_id} /><input type="hidden" name="disposition" value="RESTORED" /><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="reason" placeholder="Nota de restauración" /><button className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Restaurar review</button></form></div> : null}<form action={resolveReportAction} className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="reportType" value={report.report_type} /><input type="hidden" name="reportId" value={report.report_id} /><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" name="resolution" required minLength={2} placeholder="Resolución del caso" /><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Resolver reporte</button></form></article>) : <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No hay reportes abiertos.</p>}</div></div>
      <div><h3 className="mb-3 text-lg font-bold">Historial resuelto</h3><div className="space-y-2">{resolvedReports.map((report) => <article className="rounded-xl border border-slate-200 bg-white p-4" key={`${report.report_type}-${report.report_id}`}><p className="font-semibold">{report.category}</p><p className="mt-1 text-sm text-slate-600">{report.resolution ?? "Resuelto"}</p><p className="mt-1 text-xs text-slate-500">{report.report_type} · {report.report_id}</p></article>)}</div></div>
    </section>
  );
}
