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
        eyebrow="Operación · Finanzas"
        title="Pagos y conciliación"
        description="Primero los pendientes y desajustes; debajo queda el detalle financiero y el historial de conciliaciones."
        action={
          <form action={reconcilePaymentsAction}>
            <button className="min-h-12 w-full rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a] sm:w-auto">
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
          <h2 className="font-display text-ink text-base font-extrabold">
            Movimientos
          </h2>
          <span className="text-ink/60 text-xs font-bold">
            {payments.length} registros
          </span>
        </div>

        {payments.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {payments.map((payment) => (
              <article
                className={`rounded-3xl border p-4 sm:p-5 ${
                  payment.mismatchFlag
                    ? "border-danger/25 bg-danger/10"
                    : "border-ink/[0.08] bg-surface"
                }`}
                key={payment.paymentAttemptId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink truncate text-sm font-extrabold">
                      {payment.providerName}
                    </p>
                    <p className="text-ink/60 mt-1 text-[11px] break-all">
                      Ref. {payment.providerReference}
                    </p>
                  </div>
                  <AdminStatusBadge
                    label={payment.mismatchFlag ? "Revisar" : "Conciliado"}
                    tone={payment.mismatchFlag ? "danger" : "success"}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
                    <dt className="text-ink/60 text-[11px] font-bold">
                      Estado local
                    </dt>
                    <dd className="text-ink mt-1 font-extrabold">
                      {paymentStatusLabel(payment.localStatus)}
                    </dd>
                  </div>
                  <div className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
                    <dt className="text-ink/60 text-[11px] font-bold">
                      Proveedor de pago
                    </dt>
                    <dd className="text-ink mt-1 font-extrabold">
                      {paymentStatusLabel(payment.providerStatus)}
                    </dd>
                  </div>
                  <div className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
                    <dt className="text-ink/60 text-[11px] font-bold">Bruto</dt>
                    <dd className="text-ink mt-1 font-extrabold">
                      {money(payment.grossMinor)}
                    </dd>
                  </div>
                  <div className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
                    <dt className="text-ink/60 text-[11px] font-bold">
                      Comisión Changas
                    </dt>
                    <dd className="text-ink mt-1 font-extrabold">
                      {money(payment.marketplaceFeeMinor)}
                    </dd>
                  </div>
                </dl>

                <details className="border-ink/[0.08] bg-surface mt-3 rounded-2xl border p-3">
                  <summary className="text-ink cursor-pointer text-sm font-extrabold">
                    Ver detalle financiero
                  </summary>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-ink/60 font-bold">
                        Neto esperado prestador
                      </dt>
                      <dd className="text-ink mt-1 font-semibold">
                        {money(payment.providerExpectedNetMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink/60 font-bold">
                        Costo proveedor de pago
                      </dt>
                      <dd className="text-ink mt-1 font-semibold">
                        {money(payment.providerFeeMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink/60 font-bold">Neto observado</dt>
                      <dd className="text-ink mt-1 font-semibold">
                        {money(payment.providerNetReceivedMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink/60 font-bold">Reembolsado</dt>
                      <dd className="text-ink mt-1 font-semibold">
                        {money(payment.refundedMinor)}
                        {payment.refundStatus
                          ? ` · ${payment.refundStatus}`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                </details>

                <p className="text-ink/60 mt-3 text-[11px] leading-5">
                  Settlement: {payment.settlementStatus ?? "—"} · Última
                  conciliación: {dateTime(payment.lastReconciledAt)}
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
          <h2 className="font-display text-ink text-base font-extrabold">
            Ejecuciones de conciliación
          </h2>
          <span className="text-ink/60 text-xs font-bold">
            {runs.length} ejecuciones
          </span>
        </div>

        {runs.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {runs.map((run) => (
              <article
                className="border-ink/[0.08] bg-surface rounded-3xl border p-4"
                key={run.runId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink truncate text-sm font-extrabold">
                      {run.providerName ?? "Proveedor de pago"}
                    </p>
                    <p className="text-ink/60 mt-1 text-xs">
                      {dateTime(run.startedAt)}
                    </p>
                  </div>
                  <AdminStatusBadge
                    label={run.status.replaceAll("_", " ")}
                    tone={
                      run.failedCount || run.mismatchedCount
                        ? "danger"
                        : "success"
                    }
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[
                    ["Revisados", run.checkedCount],
                    ["Coinciden", run.matchedCount],
                    ["Desajustes", run.mismatchedCount],
                    ["Fallos", run.failedCount],
                  ].map(([label, value]) => (
                    <div
                      className="border-ink/[0.08] bg-surface rounded-xl border p-2.5"
                      key={label}
                    >
                      <p className="text-ink/60 font-bold">{label}</p>
                      <p className="text-ink mt-1 text-base font-extrabold">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                {run.errorSummary ? (
                  <p className="border-danger/25 bg-danger/10 text-danger mt-3 rounded-xl border p-3 text-xs leading-5">
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
