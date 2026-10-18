import { formatMinorUnits } from "@changas/domain";

import { voidExternalPaymentAction } from "@/app/(account)/jobs/actions";
import { ExternalPaymentDeclarationForm } from "@/app/(account)/jobs/[jobId]/external-payment-declaration-form";
import {
  externalMoneyStatusLabel,
  externalMoneyAvailableToConfirm,
  externalMoneyAvailableToDeclare,
  splitExternalMoneyPayment,
  externalPaymentMethodLabel,
  externalPaymentStateLabel,
  type ExternalMoneyLedger,
} from "@/lib/jobs/external-money";
import type { ExternalPaymentDeclaration } from "@/lib/jobs/server";
import { ExternalPaymentResponseForm } from "@/app/(account)/jobs/[jobId]/external-payment-response-form";

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
  const availableToConfirmMinor = externalMoneyAvailableToConfirm(ledger);
  const unallocatedMinor = externalMoneyAvailableToDeclare(ledger);
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
          <dt className="text-ink/70">Del precio acordado, confirmado</dt>
          <dd className="font-bold">
            {formatMinorUnits(ledger.confirmedMinor, "ARS")}
          </dd>
        </div>
        {ledger.confirmedTipMinor > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/70">Propinas confirmadas</dt>
            <dd className="font-bold text-success">
              {formatMinorUnits(ledger.confirmedTipMinor, "ARS")}
            </dd>
          </div>
        ) : null}
        {ledger.claimedMinor > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/70">Declarado, sin confirmar (incluye propinas)</dt>
            <dd className="font-bold">
              {formatMinorUnits(ledger.claimedMinor, "ARS")}
            </dd>
          </div>
        ) : null}
        <div className="border-ink/10 flex justify-between gap-3 border-t pt-1">
          <dt className="font-extrabold">Saldo del precio acordado</dt>
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

      {pending.map((declaration, index) => {
        // Pending records reserve the contractual portion in chronological order.
        // This is an estimate only; the atomic DB response makes the final split.
        const previousPendingMinor = pending
          .slice(0, index)
          .reduce((sum, item) => sum + item.amount_minor, 0);
        const estimatedContractMinor = Math.max(
          availableToConfirmMinor - previousPendingMinor,
          0,
        );
        const estimate = splitExternalMoneyPayment(
          estimatedContractMinor,
          declaration.amount_minor,
        );
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
                {estimate.tipMinor > 0 ? (
                  <p className="bg-success/[0.07] border-success/20 rounded-xl border px-3 py-2 text-[13px] leading-5">
                    Propina estimada:{" "}
                    <strong>{formatMinorUnits(estimate.tipMinor, "ARS")}</strong>.
                    Se definirá al confirmar el pago.
                  </p>
                ) : null}
                <ExternalPaymentResponseForm
                  jobId={jobId}
                  declarationId={declaration.id}
                  decision="accept"
                  isClient={isClient}
                />
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

      <ExternalPaymentDeclarationForm
        jobId={jobId}
        idempotencyKey={idempotencyKey}
        defaultAmountMinor={Math.max(0, Math.min(defaultAmountMinor, unallocatedMinor))}
        unclaimedContractMinor={unallocatedMinor}
        isClient={isClient}
      />

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
                {declaration.state === "CONFIRMED_BY_BOTH" &&
                declaration.tip_amount_minor > 0
                  ? ` · Propina: ${formatMinorUnits(declaration.tip_amount_minor, "ARS")}`
                  : ""}
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
