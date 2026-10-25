"use client";

import { useActionState, useState } from "react";
import { formatMinorUnits } from "@changas/domain";
import { parseArsMinorUnits } from "@changas/validation";

import {
  declareExternalPaymentAction,
  type ExternalPaymentDeclarationState,
} from "@/app/(account)/jobs/actions";
import { splitExternalMoneyPayment } from "@/lib/jobs/external-money";

const initialState: ExternalPaymentDeclarationState = { error: null };
const methods = [
  ["EFECTIVO", "Efectivo"],
  ["TRANSFERENCIA", "Transferencia"],
  ["OTRO_ACORDADO", "Otro acordado"],
] as const;

export function ExternalPaymentDeclarationForm({
  jobId,
  idempotencyKey,
  defaultAmountMinor,
  unclaimedContractMinor,
  isClient,
}: {
  jobId: string;
  idempotencyKey: string;
  defaultAmountMinor: number;
  unclaimedContractMinor: number;
  isClient: boolean;
}) {
  const [state, action, pending] = useActionState(
    declareExternalPaymentAction,
    initialState,
  );
  const [amount, setAmount] = useState(
    defaultAmountMinor > 0
      ? (defaultAmountMinor / 100).toLocaleString("es-AR")
      : "",
  );
  const [amountError, setAmountError] = useState("");
  const amountMinor = parseArsMinorUnits(amount) ?? null;
  const amountFeedbackId = amountError
    ? "external-payment-amount-error"
    : state.error
      ? "external-payment-server-error"
      : undefined;
  const split =
    amountMinor === null
      ? null
      : splitExternalMoneyPayment(unclaimedContractMinor, amountMinor);

  return (
    <details className="border-ink/10 rounded-xl border">
      <summary className="consumer-pressable min-h-[52px] cursor-pointer px-4 py-3 text-sm font-bold">
        {unclaimedContractMinor > 0
          ? isClient
            ? "Informar que pagué"
            : "Registrar dinero recibido"
          : isClient
            ? "Dejar una propina"
            : "Registrar propina recibida"}
      </summary>
      <form
        action={action}
        onSubmit={(event) => {
          if (amountMinor === null) {
            event.preventDefault();
            setAmountError("Ingresá un importe mayor que $0 (ej.: 15.000,50).");
          }
        }}
        className="grid gap-3 p-4 pt-0"
      >
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <p className="text-ink/75 text-[13px] leading-5">
          Registrá el total entregado. Si supera el saldo contractual pendiente,
          el excedente será una <strong>propina para el prestador</strong>. La
          otra persona debe confirmar lo declarado. YALO no recibe ni verifica
          este dinero.
        </p>
        <label className="text-[13px] font-bold">
          Importe total en ARS
          <input
            name="amount"
            aria-required="true"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountError("");
            }}
            aria-invalid={amountFeedbackId ? true : undefined}
            aria-describedby={amountFeedbackId}
            className="border-ink/15 bg-surface text-ink mt-1 w-full rounded-xl border px-3 py-2.5 text-base font-normal"
          />
        </label>
        {amountError ? (
          <p
            id="external-payment-amount-error"
            role="alert"
            className="text-danger text-[13px] leading-5"
          >
            {amountError}
          </p>
        ) : null}
        {split && split.tipMinor > 0 ? (
          <div className="border-success/30 bg-success/[0.08] rounded-xl border p-3">
            <p className="text-sm font-extrabold">Desglose estimado</p>
            <dl className="mt-1 grid gap-1 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt>Precio acordado</dt>
                <dd className="font-bold">
                  {formatMinorUnits(split.contractMinor, "ARS")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Propina</dt>
                <dd className="font-extrabold">
                  {formatMinorUnits(split.tipMinor, "ARS")}
                </dd>
              </div>
            </dl>
            <p className="text-ink/70 mt-1 text-xs leading-5">
              La distribución definitiva se registra cuando la otra parte
              confirma; puede variar si se confirman otros pagos antes.
            </p>
          </div>
        ) : null}
        <label className="text-[13px] font-bold">
          Método
          <select
            name="method"
            required
            defaultValue="EFECTIVO"
            className="border-ink/15 bg-surface text-ink mt-1 w-full rounded-xl border px-3 py-2.5 text-base font-normal"
          >
            {methods.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold">
          Fecha aproximada (opcional)
          <input
            name="paidOn"
            type="date"
            className="border-ink/15 bg-surface text-ink mt-1 w-full rounded-xl border px-3 py-2.5 text-base font-normal"
          />
        </label>
        <label className="text-[13px] font-bold">
          Referencia (opcional, sin datos bancarios)
          <input
            name="reference"
            maxLength={140}
            placeholder="Ej: comprobante 1234"
            className="border-ink/15 bg-surface text-ink mt-1 w-full rounded-xl border px-3 py-2.5 text-base font-normal"
          />
        </label>
        {state.error ? (
          <p
            id="external-payment-server-error"
            role="alert"
            className="border-danger/25 bg-danger/[0.07] text-danger rounded-xl border px-3 py-2 text-[13px] leading-5 font-semibold"
          >
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="consumer-pressable cta-ink inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-[15px] font-extrabold disabled:opacity-50"
        >
          {pending ? "Registrando…" : "Enviar declaración"}
        </button>
      </form>
    </details>
  );
}
