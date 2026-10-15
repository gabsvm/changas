import { describe, expect, it } from "vitest";

import {
  externalPaymentStateLabel,
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
