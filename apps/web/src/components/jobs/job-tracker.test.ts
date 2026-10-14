import { describe, expect, it } from "vitest";

import {
  getJobNextAction,
  getJobTracking,
} from "@/components/jobs/job-tracking";

describe("getJobTracking", () => {
  it("avanza un paso por estado del ciclo feliz", () => {
    expect(getJobTracking("CONFIRMED", null).currentIndex).toBe(0);
    expect(getJobTracking("IN_PROGRESS", null).currentIndex).toBe(1);
    expect(getJobTracking("COMPLETION_REQUESTED", null).currentIndex).toBe(2);
  });

  it("pide el pago antes que la reseña cuando hay settlement pendiente", () => {
    const tracking = getJobTracking("COMPLETED", "DUE");
    expect(tracking.currentIndex).toBe(3);
    expect(tracking.steps[3]).toMatchObject({
      key: "payment",
      state: "current",
    });
    expect(tracking.steps[4]).toMatchObject({ key: "rating", state: "todo" });
  });

  it("salta directo a reseña cuando no hay nada que pagar", () => {
    for (const settlement of ["SETTLED", "NOT_REQUIRED", "NOT_DUE", null]) {
      const tracking = getJobTracking("COMPLETED", settlement);
      expect(tracking.currentIndex).toBe(4);
      expect(tracking.steps[3]).toMatchObject({ state: "done" });
    }
  });

  it("marca la disputa como excepción, no como paso", () => {
    const tracking = getJobTracking("DISPUTED", null);
    expect(tracking.exception?.kind).toBe("disputed");
  });

  it("la cancelación no pide ninguna acción", () => {
    const tracking = getJobTracking("CANCELLED", null);
    expect(tracking.exception?.kind).toBe("cancelled");
    expect(tracking.currentIndex).toBe(-1);
  });
});

describe("getJobNextAction", () => {
  it("le da el botón correcto a cada rol en cada paso", () => {
    expect(
      getJobNextAction({
        status: "CONFIRMED",
        isClient: false,
        isProvider: true,
        settlementPending: false,
      }).kind,
    ).toBe("start");
    expect(
      getJobNextAction({
        status: "IN_PROGRESS",
        isClient: false,
        isProvider: true,
        settlementPending: false,
      }).kind,
    ).toBe("request_completion");
    expect(
      getJobNextAction({
        status: "COMPLETION_REQUESTED",
        isClient: true,
        isProvider: false,
        settlementPending: false,
      }).kind,
    ).toBe("confirm_completion");
    expect(
      getJobNextAction({
        status: "COMPLETED",
        isClient: true,
        isProvider: false,
        settlementPending: true,
        paymentsEnabled: true,
      }).kind,
    ).toBe("pay");
  });

  it("con cobro apagado no pide pagar ni muestra CTA de pago", () => {
    const client = getJobNextAction({
      status: "COMPLETED",
      isClient: true,
      isProvider: false,
      settlementPending: true,
    });
    expect(client.kind).toBeNull();
    expect(client.heading).toMatch(/pendiente de habilitación/i);
    expect(client.sub).toMatch(/aún no está disponible/i);
    const provider = getJobNextAction({
      status: "COMPLETED",
      isClient: false,
      isProvider: true,
      settlementPending: true,
    });
    expect(provider.kind).toBeNull();
    expect(provider.heading).toMatch(/pendiente de habilitación/i);
  });

  it("al que espera le explica en vez de mostrarle un botón ajeno", () => {
    const waiting = getJobNextAction({
      status: "CONFIRMED",
      isClient: true,
      isProvider: false,
      settlementPending: false,
    });
    expect(waiting.kind).toBeNull();
    expect(waiting.heading).toMatch(/confirmado/i);
  });

  it("pide el código del cliente para solicitar la finalización", () => {
    const action = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
    });
    expect(action.kind).toBe("request_completion");
    expect(action.heading).toMatch(/código/i);
  });
});
