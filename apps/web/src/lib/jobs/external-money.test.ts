import { describe, expect, it } from "vitest";

import {
  externalPaymentStateLabel,
  canConfirmExternalPayment,
  externalMoneyAvailableToConfirm,
  externalMoneyAvailableToDeclare,
  type ExternalMoneyLedger,
  type ExternalPaymentState,
} from "./external-money";

describe("externalPaymentStateLabel", () => {
  it("nombra cada estado con el vocabulario bilateral", () => {
    expect(externalPaymentStateLabel("DECLARED_BY_CLIENT")).toBe(
      "Declarado por cliente",
    );
    expect(externalPaymentStateLabel("DECLARED_BY_PROVIDER")).toBe(
      "Declarado por prestador",
    );
    expect(externalPaymentStateLabel("CONFIRMED_BY_BOTH")).toBe(
      "Confirmado por ambas partes",
    );
    expect(externalPaymentStateLabel("CONTESTED")).toBe("En desacuerdo");
    expect(externalPaymentStateLabel("VOIDED")).toBe("Anulado");
  });

  it("nunca promete verificación bancaria de YALO", () => {
    const states: ExternalPaymentState[] = [
      "DECLARED_BY_CLIENT",
      "DECLARED_BY_PROVIDER",
      "CONFIRMED_BY_BOTH",
      "CONTESTED",
      "VOIDED",
    ];
    const labels = states.map(externalPaymentStateLabel);
    for (const label of labels) {
      expect(label).not.toMatch(/verificad.*YALO|YALO.*verific/i);
    }
  });
});

function ledger(agreed: number, confirmed: number, claimed: number): ExternalMoneyLedger {
  return {
    agreedTotalMinor: agreed,
    confirmedMinor: confirmed,
    claimedMinor: claimed,
    outstandingMinor: Math.max(agreed - confirmed, 0),
  };
}

describe("external cash/transfer confirmation limits", () => {
  it("allows confirmation for the exact remaining balance", () => {
    const current = ledger(500_00, 200_00, 300_00);
    expect(externalMoneyAvailableToConfirm(current)).toBe(300_00);
    expect(canConfirmExternalPayment(current, 300_00)).toBe(true);
  });

  it("does not double-count the declaration currently being accepted", () => {
    const current = ledger(1_000_00, 0, 1_000_00);
    expect(canConfirmExternalPayment(current, 1_000_00)).toBe(true);
    expect(externalMoneyAvailableToDeclare(current)).toBe(0);
  });

  it("blocks a second confirmation that exceeds the agreement", () => {
    const current = ledger(1_000_00, 750_00, 600_00);
    expect(externalMoneyAvailableToConfirm(current)).toBe(250_00);
    expect(canConfirmExternalPayment(current, 600_00)).toBe(false);
    expect(externalMoneyAvailableToDeclare(current)).toBe(0);
  });

  it("prevents negative balances and invalid confirmation amounts", () => {
    const current = ledger(500_00, 700_00, 150_00);
    expect(externalMoneyAvailableToConfirm(current)).toBe(0);
    expect(externalMoneyAvailableToDeclare(current)).toBe(0);
    expect(canConfirmExternalPayment(current, 1)).toBe(false);
    expect(canConfirmExternalPayment(ledger(500_00, 0, 0), 0)).toBe(false);
    expect(canConfirmExternalPayment(ledger(500_00, 0, 0), Number.NaN)).toBe(false);
  });

  it("allows partial payments when the sum stays within the agreement", () => {
    const current = ledger(900_00, 300_00, 200_00);
    expect(externalMoneyAvailableToDeclare(current)).toBe(400_00);
    expect(canConfirmExternalPayment(current, 200_00)).toBe(true);
  });
});
