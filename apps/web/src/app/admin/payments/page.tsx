import { reconcilePaymentsAction } from "./actions";

import { listAdminPayments } from "@/lib/payments/server-admin";

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

export default async function AdminPaymentsPage() {
  const { payments, runs } = await listAdminPayments();
  const mismatches = payments.filter((payment) => payment.mismatchFlag).length;
  const pending = payments.filter(
    (payment) => payment.localStatus === "PENDING",
  ).length;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pagos y conciliación</h2>
          <p className="mt-1 text-sm text-slate-600">
            Estado local, observación del proveedor, comisiones, devoluciones y
            conciliación financiera.
          </p>
        </div>
        <form action={reconcilePaymentsAction}>
          <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Conciliar Mercado Pago
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Pagos visibles</p>
          <p className="mt-1 text-2xl font-bold">{payments.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-1 text-2xl font-bold">{pending}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Desajustes</p>
          <p className="mt-1 text-2xl font-bold">{mismatches}</p>
        </article>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Movimientos</h3>
        {payments.length ? (
          payments.map((payment) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-4"
              key={payment.paymentAttemptId}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{payment.providerName}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    Ref. {payment.providerReference}
                  </p>
                </div>
                <span
                  className={
                    payment.mismatchFlag
                      ? "rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800"
                      : "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"
                  }
                >
                  {payment.mismatchFlag ? "REVISAR" : "CONCILIADO"}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Estado local</dt>
                  <dd className="font-semibold">{payment.localStatus}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Estado proveedor</dt>
                  <dd className="font-semibold">
                    {payment.providerStatus ?? "Sin observar"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Bruto</dt>
                  <dd className="font-semibold">{money(payment.grossMinor)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Comisión Changas</dt>
                  <dd className="font-semibold">
                    {money(payment.marketplaceFeeMinor)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Neto esperado prestador</dt>
                  <dd className="font-semibold">
                    {money(payment.providerExpectedNetMinor)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Costo proveedor de pago</dt>
                  <dd className="font-semibold">
                    {money(payment.providerFeeMinor)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Neto observado</dt>
                  <dd className="font-semibold">
                    {money(payment.providerNetReceivedMinor)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Reembolsado</dt>
                  <dd className="font-semibold">
                    {money(payment.refundedMinor)}
                    {payment.refundStatus ? ` · ${payment.refundStatus}` : ""}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-xs text-slate-500">
                Settlement: {payment.settlementStatus ?? "—"} · Última
                conciliación: {dateTime(payment.lastReconciledAt)}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Todavía no hay pagos reales registrados.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Ejecuciones de conciliación</h3>
        {runs.length ? (
          runs.map((run) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={run.runId}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">
                  {run.providerName ?? "Proveedor"} · {run.status}
                </p>
                <p className="text-xs text-slate-500">
                  {dateTime(run.startedAt)}
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Revisados {run.checkedCount} · Coinciden {run.matchedCount} ·
                Desajustes {run.mismatchedCount} · Fallos {run.failedCount}
              </p>
              {run.errorSummary ? (
                <p className="mt-2 text-sm text-red-700">{run.errorSummary}</p>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No hay ejecuciones de conciliación todavía.
          </p>
        )}
      </div>
    </section>
  );
}
