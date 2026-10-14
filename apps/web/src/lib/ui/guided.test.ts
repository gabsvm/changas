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

  it("no exige cobro online con pagos OFF: prestador activo con servicio trabaja igual", () => {
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
    // Pagos OFF (default): sin MP igual queda listo para trabajar.
    expect(
      getProviderNextAction({
        ...base,
        isProvider: true,
        providerActive: true,
        hasServices: true,
      }).cta,
    ).toBe("Ver mis servicios");
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

  it("solo pide conectar Mercado Pago con pagos online habilitados", () => {
    expect(
      getProviderNextAction({
        isProvider: true,
        providerActive: true,
        onboardingStep: 4,
        hasServices: true,
        paymentConnected: false,
        paymentsEnabled: true,
      }).cta,
    ).toBe("Conectar Mercado Pago");
  });

  it("el paso de pago del cliente es externo, sin checkout imposible", () => {
    const hirePay = CLIENT_HIRE_STEPS[3];
    expect(hirePay?.action).not.toBe("Pagá");
    expect(`${hirePay?.action} ${hirePay?.hint}`).toMatch(
      /externo|directo|entre|acord/i,
    );
  });

  it("con pagos OFF no muestra Ir a pagar aunque haya pago pendiente", () => {
    const pending = getClientNextAction({
      activeJobs: 2,
      pendingPayment: true,
    });
    expect(pending.cta).not.toBe("Ir a pagar");
    expect(pending.cta).toBe("Ver mis trabajos");
    expect(`${pending.title} ${pending.hint}`).toMatch(
      /entre ustedes|externo/i,
    );
    expect(getClientNextAction({ activeJobs: 1, pendingPayment: false }).cta).toBe(
      "Ver mi trabajo",
    );
    expect(getClientNextAction({ activeJobs: 0, pendingPayment: false }).cta).toBe(
      "Buscar un servicio",
    );
  });

  it("con pagos online habilitados sí prioriza Ir a pagar", () => {
    expect(
      getClientNextAction({
        activeJobs: 2,
        pendingPayment: true,
        paymentsEnabled: true,
      }).cta,
    ).toBe("Ir a pagar");
  });
});
