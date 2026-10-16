import { formatMinorUnits } from "@changas/domain";

import {
  declareExternalPaymentAction,
  voidExternalPaymentAction,
} from "@/app/(account)/jobs/actions";
import {
  externalMoneyStatusLabel,
  externalPaymentMethodLabel,
  externalPaymentStateLabel,
  type ExternalMoneyLedger,
} from "@/lib/jobs/external-money";
import type { ExternalPaymentDeclaration } from "@/lib/jobs/server";
import { ExternalPaymentResponseForm } from "@/app/(account)/jobs/[jobId]/external-payment-response-form";

const METHOD_OPTIONS = ["EFECTIVO", "TRANSFERENCIA", "OTRO_ACORDADO"] as const;

function formatPaidOn(paidOn: string | null): string {
  if (!paidOn) return "sin fecha informada";
  const parsed = new Date(`${paidOn}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return paidOn;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
    parsed,
  );
}

export function ExternalMoneySection({
  jobId,
  isClient,
  clientUserId,
  ledger,
  declarations,
  defaultAmountMinor,
}: {
  jobId: string;
  isClient: boolean;
  clientUserId: string;
  ledger: ExternalMoneyLedger;
  declarations: ExternalPaymentDeclaration[];
  defaultAmountMinor: number;
}) {
  const availableToConfirmMinor = Math.max(
    0,
    ledger.agreedTotalMinor - ledger.confirmedMinor,
  );
  const unallocatedMinor = Math.max(
    0,
    availableToConfirmMinor - ledger.claimedMinor,
  );
  const pending = declarations.filter(
    (declaration) =>
      declaration.state === "DECLARED_BY_CLIENT" ||
      declaration.state === "DECLARED_BY_PROVIDER",
  );
  // Clave estable por instancia del formulario: el doble envío del mismo
  // form llega con la misma clave y la RPC lo vuelve idempotente.
  const idempotencyKey = crypto.randomUUID();

  return (
    <div className="grid gap-4">
      <dl className="space-y-1 text-sm leading-6">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/70">Acordado</dt>
          <dd className="font-bold">
            {formatMinorUnits(ledger.agreedTotalMinor, "ARS")}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/70">Confirmado por ambas partes</dt>
          <dd className="font-bold">
            {formatMinorUnits(ledger.confirmedMinor, "ARS")}
          </dd>
        </div>
        {ledger.claimedMinor > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/70">Pendiente de confirmación</dt>
            <dd className="font-bold">
              {formatMinorUnits(ledger.claimedMinor, "ARS")}
            </dd>
          </div>
        ) : null}
        <div className="border-ink/10 flex justify-between gap-3 border-t pt-1">
          <dt className="font-extrabold">Saldo</dt>
          <dd className="font-extrabold">
            {formatMinorUnits(ledger.outstandingMinor, "ARS")}
          </dd>
        </div>
      </dl>
      <p className="text-sm font-bold">
        Estado: {externalMoneyStatusLabel(ledger)}
      </p>
      <p className="text-ink/70 text-xs leading-5">
        Pueden acordar efectivo o transferencia directamente. YALO no recibe ni
        custodia el dinero; lo declarado acá no está verificado por YALO.
      </p>

      {pending.map((declaration) => {
        const mine = isClient
          ? declaration.declared_by_user_id === clientUserId
          : declaration.declared_by_user_id !== clientUserId;
        const counterpart = !mine;
        return (
          <div
            key={declaration.id}
            className="border-ink/10 rounded-xl border p-3"
          >
            <p className="text-sm">
              <strong>
                {formatMinorUnits(declaration.amount_minor, "ARS")}
              </strong>{" "}
              · {externalPaymentMethodLabel(declaration.method)} ·{" "}
              {externalPaymentStateLabel(declaration.state)}
            </p>
            <p className="text-ink/70 mt-1 text-xs leading-5">
              {declaration.declared_by_user_id === clientUserId
                ? "Declarado por cliente"
                : "Declarado por prestador"}{" "}
              · {formatPaidOn(declaration.paid_on)}
              {declaration.reference ? ` · Ref: ${declaration.reference}` : ""}
            </p>
            {counterpart ? (
              <div className="mt-2 grid gap-2">
                {declaration.amount_minor > availableToConfirmMinor ? (
                  <p
                    role="alert"
                    className="border-warning/30 bg-warning/[0.08] text-ink rounded-xl border px-3 py-2.5 text-[13px] leading-5"
                  >
                    <strong>Este importe no se puede confirmar.</strong>{" "}
                    La declaración es de{" "}
                    {formatMinorUnits(declaration.amount_minor, "ARS")}, pero
                    quedan {formatMinorUnits(availableToConfirmMinor, "ARS")} del
                    total acordado sin confirmar. Pedile a quien la registró que
                    la anule y vuelva a informar el importe correcto.
                    No confirmamos un pago que supere lo acordado.
                  </p>
                ) : (
                  <ExternalPaymentResponseForm
                    jobId={jobId}
                    declarationId={declaration.id}
                    decision="accept"
                    isClient={isClient}
                  />
                )}
                <details className="border-ink/10 rounded-xl border">
                  <summary className="consumer-pressable min-h-11 cursor-pointer px-4 py-2.5 text-sm font-bold">
                    {isClient ? "No lo pagué" : "No lo recibí"}
                  </summary>
                  <ExternalPaymentResponseForm
                    jobId={jobId}
                    declarationId={declaration.id}
                    decision="contest"
                    isClient={isClient}
                  />
                </details>
              </div>
            ) : (
              <form action={voidExternalPaymentAction} className="mt-2">
                <input type="hidden" name="jobId" value={jobId} />
                <input
                  type="hidden"
                  name="declarationId"
                  value={declaration.id}
                />
                <button className="consumer-pressable text-ink/70 hover:bg-ink/[0.045] inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-bold">
                  Anular esta declaración
                </button>
              </form>
            )}
          </div>
        );
      })}

      {unallocatedMinor > 0 ? (
      <details className="border-ink/10 rounded-xl border">
        <summary className="consumer-pressable min-h-[52px] cursor-pointer px-4 py-3 text-sm font-bold">
          {isClient ? "Informar que pagué" : "Registrar dinero recibido"}
        </summary>
        <form
          action={declareExternalPaymentAction}
          className="grid gap-3 p-4 pt-0"
        >
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <p className="text-ink/70 text-xs leading-5">
            Esta declaración se envía a la otra parte; todavía no significa que
            esté confirmada.
          </p>
          <label className="text-[13px] font-bold">
            Monto en ARS
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={(Math.min(defaultAmountMinor, unallocatedMinor) / 100).toLocaleString("es-AR")}
              className="border-ink/15 mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="text-[13px] font-bold">
            Método
            <select
              name="method"
              required
              defaultValue="TRANSFERENCIA"
              className="border-ink/15 mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
            >
              {METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>
                  {externalPaymentMethodLabel(method)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-bold">
            Fecha aproximada (opcional)
            <input
              name="paidOn"
              type="date"
              className="border-ink/15 mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="text-[13px] font-bold">
            Referencia (opcional, sin datos bancarios)
            <input
              name="reference"
              maxLength={140}
              placeholder="Ej: comprobante 1234"
              className="border-ink/15 mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <button className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold">
            Enviar declaración
          </button>
        </form>
      </details>
      ) : (
        <p
          role="status"
          className="border-ink/10 bg-ink/[0.04] text-ink/80 rounded-xl border px-3 py-3 text-[13px] leading-5"
        >
          {ledger.claimedMinor > 0
            ? "Ya está declarado el importe pendiente. Esperá la respuesta de la otra parte antes de informar otro pago."
            : "El importe acordado ya está confirmado por ambas partes."}
        </p>
      )}

      {declarations.length > 0 ? (
        <div>
          <p className="text-[13px] font-extrabold">Historial</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {declarations.map((declaration) => (
              <li
                key={declaration.id}
                className="text-ink/70 text-[13px] leading-5"
              >
                {formatMinorUnits(declaration.amount_minor, "ARS")} ·{" "}
                {externalPaymentMethodLabel(declaration.method)} ·{" "}
                {externalPaymentStateLabel(declaration.state)}
                {declaration.state === "CONTESTED" &&
                declaration.counterpart_reason
                  ? ` · Motivo: ${declaration.counterpart_reason}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
