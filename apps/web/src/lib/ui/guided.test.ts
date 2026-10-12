import { describe, expect, it } from "vitest";

import {
  CLIENT_HIRE_STEPS,
  PROVIDER_START_STEPS,
  getClientNextAction,
  getProviderNextAction,
  guideProgress,
} from "./guided";

describe("guided flows", () => {
  it("keeps every guided step ultracorto: verbo primero, sin párrafos", () => {
    for (const step of [...CLIENT_HIRE_STEPS, ...PROVIDER_START_STEPS]) {
      expect(step.action.split(" ").length).toBeLessThanOrEqual(2);
      expect(step.hint.split(" ").length).toBeLessThanOrEqual(6);
    }
  });

  it("clamps progress to the current step", () => {
    expect(guideProgress(1, 4)).toBe(25);
    expect(guideProgress(99, 4)).toBe(100);
    expect(guideProgress(0, 4)).toBe(25);
    expect(guideProgress(2, 0)).toBe(0);
  });

  it("walks the provider funnel in order: alta, publicar, cobrar, listo", () => {
    const base = {
      isProvider: false,
      providerActive: false,
      onboardingStep: 1,
      hasServices: false,
      paymentConnected: false,
    };
    expect(getProviderNextAction(base).href).toBe("/provider/onboarding");
    expect(
      getProviderNextAction({ ...base, isProvider: true }).cta,
    ).toContain("Seguir");
    expect(
      getProviderNextAction({ ...base, isProvider: true, providerActive: true })
        .cta,
    ).toBe("Publicar servicio");
    expect(
      getProviderNextAction({
        ...base,
        isProvider: true,
        providerActive: true,
        hasServices: true,
      }).cta,
    ).toBe("Conectar Mercado Pago");
    expect(
      getProviderNextAction({
        ...base,
        isProvider: true,
        providerActive: true,
        hasServices: true,
        paymentConnected: true,
      }).cta,
    ).toBe("Ver mis servicios");
  });

  it("prioritizes a pending payment over everything for the client", () => {
    expect(
      getClientNextAction({ activeJobs: 2, pendingPayment: true }).cta,
    ).toBe("Ir a pagar");
    expect(getClientNextAction({ activeJobs: 1, pendingPayment: false }).cta).toBe(
      "Ver mi trabajo",
    );
    expect(getClientNextAction({ activeJobs: 0, pendingPayment: false }).cta).toBe(
      "Buscar un servicio",
    );
  });
});
