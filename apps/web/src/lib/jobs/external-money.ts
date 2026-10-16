/**
 * Dinero bilateral con pagos OFF (YALO S4, SPEC 7.2).
 * Vocabulario obligatorio: Acordado, Declarado por cliente/prestador,
 * Pendiente de confirmación, Confirmado por ambas partes, En desacuerdo.
 * Jamás "verificado por YALO": no existe fuente técnica que lo respalde.
 */

export type ExternalPaymentState =
  | "DECLARED_BY_CLIENT"
  | "DECLARED_BY_PROVIDER"
  | "CONFIRMED_BY_BOTH"
  | "CONTESTED"
  | "VOIDED";

export type ExternalPaymentMethod =
  "EFECTIVO" | "TRANSFERENCIA" | "OTRO_ACORDADO";

export function externalPaymentStateLabel(state: ExternalPaymentState): string {
  switch (state) {
    case "DECLARED_BY_CLIENT":
      return "Declarado por cliente";
    case "DECLARED_BY_PROVIDER":
      return "Declarado por prestador";
    case "CONFIRMED_BY_BOTH":
      return "Confirmado por ambas partes";
    case "CONTESTED":
      return "En desacuerdo";
    case "VOIDED":
      return "Anulado";
  }
}

export function externalPaymentMethodLabel(
  method: ExternalPaymentMethod,
): string {
  switch (method) {
    case "EFECTIVO":
      return "Efectivo";
    case "TRANSFERENCIA":
      return "Transferencia";
    case "OTRO_ACORDADO":
      return "Otro acordado";
  }
}

export type ExternalMoneyLedger = {
  agreedTotalMinor: number;
  confirmedMinor: number;
  claimedMinor: number;
  outstandingMinor: number;
  confirmedTipMinor: number;
};

/** A pending declaration is not a confirmed payment; never count it twice. */
export function externalMoneyAvailableToConfirm(
  ledger: ExternalMoneyLedger,
): number {
  return Math.max(0, ledger.agreedTotalMinor - ledger.confirmedMinor);
}

/** Unclaimed balance for a new declaration; pending amounts reserve it in UX. */
export function externalMoneyAvailableToDeclare(
  ledger: ExternalMoneyLedger,
): number {
  return Math.max(0, externalMoneyAvailableToConfirm(ledger) - ledger.claimedMinor);
}

/** Allocation preview: first cover the outstanding contract, remainder is a tip.
 * The authoritative allocation is saved by the database when both parties
 * confirm the declaration. Pending declarations are estimates only.
 */
export function splitExternalMoneyPayment(
  remainingContractMinor: number,
  amountMinor: number,
): { contractMinor: number; tipMinor: number } {
  if (
    !Number.isSafeInteger(remainingContractMinor) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    return { contractMinor: 0, tipMinor: 0 };
  }
  const contractMinor = Math.min(Math.max(0, remainingContractMinor), amountMinor);
  return { contractMinor, tipMinor: amountMinor - contractMinor };
}

export function externalMoneyStatusLabel(ledger: ExternalMoneyLedger): string {
  if (ledger.claimedMinor > 0) {
    return "Pendiente de confirmación";
  }
  if (ledger.outstandingMinor <= 0 && ledger.confirmedMinor > 0) {
    return "Confirmado por ambas partes";
  }
  if (ledger.confirmedMinor > 0) {
    return "Pago parcial confirmado";
  }
  return "Sin declarar";
}
