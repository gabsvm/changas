import { describe, expect, it } from "vitest";

import { getProviderNextAction, guideProgress } from "./guided";

const baseProvider = {
  isProvider: true,
  providerActive: false,
  onboardingStep: 2,
  hasServices: false,
  paymentConnected: false,
};
describe("guided flows", () => {
  it("clamps progress to the current step", () => {
    expect(guideProgress(1, 4)).toBe(25);
    expect(guideProgress(99, 4)).toBe(100);
    expect(guideProgress(0, 4)).toBe(25);
    expect(guideProgress(2, 0)).toBe(0);
  });
});

describe("getProviderNextAction por estado", () => {
  it("no es proveedor: invita a empezar el alta", () => {
    const next = getProviderNextAction({
      ...baseProvider,
      isProvider: false,
      status: "NOT_STARTED",
    });
    expect(next.href).toBe("/provider/onboarding");
    expect(next.cta).toBe("Empezar ahora");
  });

  it("alta incompleta: pide terminar el paso a paso", () => {
    const next = getProviderNextAction({
      ...baseProvider,
      status: "PROFILE_INCOMPLETE",
    });
    expect(next.title).toBe("Terminá tu alta");
    expect(next.href).toBe("/provider/onboarding");
  });

  it("revisión pendiente: banner tranquilo con borrador, no alta incompleta", () => {
    for (const status of ["IDENTITY_PENDING", "UNDER_REVIEW"]) {
      const next = getProviderNextAction({ ...baseProvider, status });
      expect(next.title).toBe("Tu identidad está en revisión");
      expect(next.cta).toBe("Crear servicios en borrador");
      expect(next.href).toBe("/provider/manage");
    }
  });

  it("rechazado: dice qué corregir con link a revisión", () => {
    const next = getProviderNextAction({
      ...baseProvider,
      status: "REJECTED",
    });
    expect(next.title).toBe("La revisión te pide un ajuste");
    expect(next.href).toBe("/provider/onboarding/review");
  });

  it("activo sin servicios: publica el primero", () => {
    const next = getProviderNextAction({
      ...baseProvider,
      providerActive: true,
      status: "ACTIVE",
    });
    expect(next.href).toBe("/provider/manage#servicios");
    expect(next.cta).toBe("Publicar servicio");
  });

  it("suspendido/restringido/desactivado: mensaje llano sin callejón", () => {
    expect(
      getProviderNextAction({ ...baseProvider, status: "SUSPENDED" }).href,
    ).toBe("/account");
    expect(
      getProviderNextAction({ ...baseProvider, status: "RESTRICTED" }).href,
    ).toBe("/account");
    expect(
      getProviderNextAction({ ...baseProvider, status: "DEACTIVATED" }).href,
    ).toBe("/provider/onboarding");
  });

  it("sin status conserva el contrato viejo por booleano", () => {
    expect(
      getProviderNextAction({ ...baseProvider }).title,
    ).toBe("Terminá tu alta");
    expect(
      getProviderNextAction({ ...baseProvider, providerActive: true }).href,
    ).toBe("/provider/manage#servicios");
  });
});
