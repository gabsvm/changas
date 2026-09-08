import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { listAdminPayments } from "@/lib/payments/server-admin";

import { reconcilePaymentsAction } from "./actions";

function money(amountMinor: number | null, currency = "ARS") {
  if (amountMinor === null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function paymentStatusLabel(status: string | null) {
  if (!status) return "Sin observar";
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobado",
    AUTHORIZED: "Autorizado",
    IN_PROCESS: "Procesando",
    IN_MEDIATION: "En mediación",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
    REFUNDED: "Reembolsado",
    CHARGED_BACK: "Contracargo",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export default async function AdminPaymentsPage() {
  const { payments, runs } = await listAdminPayments();
  const mismatches = payments.filter((payment) => payment.mismatchFlag).length;
  const pending = payments.filter(
    (payment) => payment.localStatus === "PENDING",
  ).length;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Finanzas"
        title="Pagos y conciliación"
        description="Primero los pendientes y desajustes; debajo queda el detalle financiero y el historial de conciliaciones."
        action={
          <form action={reconcilePaymentsAction}>
            <button className="min-h-12 w-full rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a] sm:w-auto">
              Conciliar Mercado Pago
            </button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AdminMetricCard
          label="Pagos visibles"
          value={payments.length}
          hint="Intentos registrados"
          tone="info"
        />
        <AdminMetricCard
          label="Pendientes"
          value={pending}
          hint="Requieren seguimiento"
          tone={pending ? "pending" : "success"}
        />
        <div className="col-span-2 sm:col-span-1">
          <AdminMetricCard
            label="Desajustes"
            value={mismatches}
            hint="Local vs proveedor"
            tone={mismatches ? "danger" : "success"}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-white">Movimientos</h2>
          <span className="text-xs font-bold text-[#697386]">{payments.length} registros</span>
        </div>

        {payments.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {payments.map((payment) => (
              <article
                className={`rounded-[1.5rem] border p-4 sm:p-5 ${
                  payment.mismatchFlag
                    ? "border-[#ef5350]/35 bg-[#ef5350]/7"
                    : "border-[#273142] bg-[#151c27]"
                }`}
                key={payment.paymentAttemptId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">
                      {payment.providerName}
                    </p>
                    <p className="mt-1 break-all text-[0.68rem] text-[#697386]">
                      Ref. {payment.providerReference}
                    </p>
                  </div>
                  <AdminStatusBadge
                    label={payment.mismatchFlag ? "Revisar" : "Conciliado"}
                    tone={payment.mismatchFlag ? "danger" : "success"}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl border border-[#273142] bg-[#101720] p-3">
                    <dt className="text-[0.68rem] font-bold text-[#697386]">Estado local</dt>
                    <dd className="mt-1 font-extrabold text-[#d0d5dd]">
                      {paymentStatusLabel(payment.localStatus)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-[#273142] bg-[#101720] p-3">
                    <dt className="text-[0.68rem] font-bold text-[#697386]">Proveedor de pago</dt>
                    <dd className="mt-1 font-extrabold text-[#d0d5dd]">
                      {paymentStatusLabel(payment.providerStatus)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-[#273142] bg-[#101720] p-3">
                    <dt className="text-[0.68rem] font-bold text-[#697386]">Bruto</dt>
                    <dd className="mt-1 font-extrabold text-white">{money(payment.grossMinor)}</dd>
                  </div>
                  <div className="rounded-2xl border border-[#273142] bg-[#101720] p-3">
                    <dt className="text-[0.68rem] font-bold text-[#697386]">Comisión Changas</dt>
                    <dd className="mt-1 font-extrabold text-white">
                      {money(payment.marketplaceFeeMinor)}
                    </dd>
                  </div>
                </dl>

                <details className="mt-3 rounded-2xl border border-[#273142] bg-[#101720] p-3">
                  <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
                    Ver detalle financiero
                  </summary>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-[#697386]">Neto esperado prestador</dt>
                      <dd className="mt-1 font-semibold text-[#d0d5dd]">
                        {money(payment.providerExpectedNetMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[#697386]">Costo proveedor de pago</dt>
                      <dd className="mt-1 font-semibold text-[#d0d5dd]">
                        {money(payment.providerFeeMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[#697386]">Neto observado</dt>
                      <dd className="mt-1 font-semibold text-[#d0d5dd]">
                        {money(payment.providerNetReceivedMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[#697386]">Reembolsado</dt>
                      <dd className="mt-1 font-semibold text-[#d0d5dd]">
                        {money(payment.refundedMinor)}
                        {payment.refundStatus ? ` · ${payment.refundStatus}` : ""}
                      </dd>
                    </div>
                  </dl>
                </details>

                <p className="mt-3 text-[0.68rem] leading-5 text-[#697386]">
                  Settlement: {payment.settlementStatus ?? "—"} · Última conciliación: {dateTime(payment.lastReconciledAt)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="Todavía no hay pagos registrados"
            description="Los intentos reales aparecerán acá cuando empiece la operatoria de pagos."
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-white">Ejecuciones de conciliación</h2>
          <span className="text-xs font-bold text-[#697386]">{runs.length} ejecuciones</span>
        </div>

        {runs.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {runs.map((run) => (
              <article
                className="rounded-[1.35rem] border border-[#273142] bg-[#151c27] p-4"
                key={run.runId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">
                      {run.providerName ?? "Proveedor de pago"}
                    </p>
                    <p className="mt-1 text-xs text-[#697386]">{dateTime(run.startedAt)}</p>
                  </div>
                  <AdminStatusBadge
                    label={run.status.replaceAll("_", " ")}
                    tone={run.failedCount || run.mismatchedCount ? "danger" : "success"}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[
                    ["Revisados", run.checkedCount],
                    ["Coinciden", run.matchedCount],
                    ["Desajustes", run.mismatchedCount],
                    ["Fallos", run.failedCount],
                  ].map(([label, value]) => (
                    <div className="rounded-xl border border-[#273142] bg-[#101720] p-2.5" key={label}>
                      <p className="font-bold text-[#697386]">{label}</p>
                      <p className="mt-1 text-base font-extrabold text-[#d0d5dd]">{value}</p>
                    </div>
                  ))}
                </div>
                {run.errorSummary ? (
                  <p className="mt-3 rounded-xl border border-[#ef5350]/25 bg-[#ef5350]/8 p-3 text-xs leading-5 text-[#ff7774]">
                    {run.errorSummary}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="No hay conciliaciones todavía"
            description="Cuando ejecutes una conciliación, el resumen de cada corrida quedará disponible acá."
          />
        )}
      </div>
    </section>
  );
}
