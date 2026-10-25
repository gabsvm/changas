import { describe, expect, it } from "vitest";

import {
  externalPaymentStateLabel,
  splitExternalMoneyPayment,
  externalMoneyStatusLabel,
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

function ledger(
  agreed: number,
  confirmed: number,
  claimed: number,
): ExternalMoneyLedger {
  return {
    agreedTotalMinor: agreed,
    confirmedMinor: confirmed,
    claimedMinor: claimed,
    outstandingMinor: Math.max(agreed - confirmed, 0),
    confirmedTipMinor: 0,
  };
}

describe("external payments with voluntary tips", () => {
  it("covers the agreed balance first and allocates the excess as a tip", () => {
    const pending = ledger(100_000, 0, 120_000);
    expect(externalMoneyAvailableToConfirm(pending)).toBe(100_000);
    expect(splitExternalMoneyPayment(100_000, 120_000)).toEqual({
      contractMinor: 100_000,
      tipMinor: 20_000,
    });
    expect(externalMoneyAvailableToDeclare(pending)).toBe(0);
  });

  it("preserves exact payments without creating fictitious tips", () => {
    expect(splitExternalMoneyPayment(50_000, 50_000)).toEqual({
      contractMinor: 50_000,
      tipMinor: 0,
    });
  });

  it("allows a tip-only declaration after the contract is fully paid", () => {
    const paid = ledger(100_000, 100_000, 0);
    expect(externalMoneyAvailableToDeclare(paid)).toBe(0);
    expect(
      splitExternalMoneyPayment(externalMoneyAvailableToConfirm(paid), 25_000),
    ).toEqual({ contractMinor: 0, tipMinor: 25_000 });
  });

  it("keeps the contractual outstanding amount independent of tips", () => {
    const current = ledger(100_000, 75_000, 40_000);
    expect(externalMoneyAvailableToConfirm(current)).toBe(25_000);
    expect(splitExternalMoneyPayment(25_000, 40_000)).toEqual({
      contractMinor: 25_000,
      tipMinor: 15_000,
    });
    expect(externalMoneyAvailableToDeclare(current)).toBe(0);
  });

  it("does not fabricate a value for invalid amounts", () => {
    for (const amount of [0, -1, NaN, Infinity, 1.5]) {
      expect(splitExternalMoneyPayment(100_000, amount)).toEqual({
        contractMinor: 0,
        tipMinor: 0,
      });
    }
  });

  it("shows pending tips as pending even when the contract is paid", () => {
    expect(externalMoneyStatusLabel(ledger(100_000, 100_000, 10_000))).toBe(
      "Pendiente de confirmación",
    );
  });
});
