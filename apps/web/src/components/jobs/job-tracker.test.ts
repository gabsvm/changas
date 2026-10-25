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
    expect(tracking.steps[3]?.label).toMatch(/externo/i);
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
    ).toBe("submit_delivery");
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

  it("con cobro apagado dirige al pago externo entre las partes", () => {
    const client = getJobNextAction({
      status: "COMPLETED",
      isClient: true,
      isProvider: false,
      settlementPending: true,
    });
    expect(client.kind).toBeNull();
    expect(client.heading).toMatch(/entre ustedes|externo/i);
    expect(client.heading).not.toMatch(/habilitaci/i);
    expect(client.sub).toMatch(/directamente|declarado/i);
    const provider = getJobNextAction({
      status: "COMPLETED",
      isClient: false,
      isProvider: true,
      settlementPending: true,
    });
    expect(provider.kind).toBeNull();
    expect(provider.heading).toMatch(/entre ustedes|externo/i);
    expect(provider.heading).not.toMatch(/habilitaci/i);
    expect(provider.sub).toMatch(/directamente|declarado/i);
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

  it("pide enviar la entrega antes que el código (presencial)", () => {
    const action = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      modality: "IN_PERSON",
    });
    expect(action.kind).toBe("submit_delivery");
    expect(action.heading).toMatch(/revisi/i);
    expect(action.sub).toMatch(/antes de compartir el PIN/i);
  });

  it("en remoto no menciona PIN ni código", () => {
    const action = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      modality: "REMOTE",
    });
    expect(action.kind).toBe("submit_delivery");
    expect(action.heading).toMatch(/digital/i);
    expect(action.sub).not.toMatch(/PIN|4 dígitos/i);
  });

  it("tras el envío presencial pide la constancia PIN", () => {
    const action = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      modality: "IN_PERSON",
      deliverySubmitted: true,
    });
    expect(action.kind).toBe("verify_handover");
    expect(action.heading).toMatch(/PIN/i);
    expect(action.sub).toMatch(/tras revisar/i);
  });

  it("tras la constancia queda en espera de revisión", () => {
    const action = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      modality: "IN_PERSON",
      deliverySubmitted: true,
      handoverVerified: true,
    });
    expect(action.kind).toBeNull();
    expect(action.heading).toMatch(/esperando revisión/i);
  });
});

describe("getJobNextAction J1: estados finales y salidas", () => {
  it("J1a: post-reseña cierra el hero con CTA de salida en vez de pedir reseña", () => {
    const client = getJobNextAction({
      status: "COMPLETED",
      isClient: true,
      isProvider: false,
      settlementPending: false,
      hasReview: true,
    });
    expect(client.kind).toBeNull();
    expect(client.heading).toMatch(/ya dejaste tu reseña/i);
    expect(client.href).toBe("/buscar");
    expect(client.hrefLabel).toMatch(/buscar otro servicio/i);
    const provider = getJobNextAction({
      status: "COMPLETED",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      hasReview: true,
    });
    expect(provider.kind).toBeNull();
    expect(provider.heading).toMatch(/reseña/i);
    expect(provider.href).toBe("/jobs");
  });

  it("J1a: sin reseña sigue pidiendo la reseña al cliente", () => {
    const action = getJobNextAction({
      status: "COMPLETED",
      isClient: true,
      isProvider: false,
      settlementPending: false,
    });
    expect(action.kind).toBe("review");
  });

  it("J1b: terminales tienen rama propia con CTA de recuperación", () => {
    for (const status of ["CANCELLED", "NO_SHOW", "EXPIRED"] as const) {
      const client = getJobNextAction({
        status,
        isClient: true,
        isProvider: false,
        settlementPending: false,
      });
      expect(client.kind).toBeNull();
      expect(client.href).toBe("/buscar");
      expect(client.hrefLabel).toMatch(/prestador/i);
      const providerJobs = getJobNextAction({
        status,
        isClient: false,
        isProvider: true,
        settlementPending: false,
      });
      expect(providerJobs.kind).toBeNull();
      expect(providerJobs.href).toBe("/jobs");
      const providerOpo = getJobNextAction({
        status,
        isClient: false,
        isProvider: true,
        settlementPending: false,
        opportunitiesEnabled: true,
      });
      expect(providerOpo.href).toBe("/oportunidades");
      expect(providerOpo.hrefLabel).toMatch(/oportunidades/i);
    }
    expect(
      getJobNextAction({
        status: "CANCELLED",
        isClient: true,
        isProvider: false,
        settlementPending: false,
      }).heading,
    ).toMatch(/canceló/i);
    expect(
      getJobNextAction({
        status: "EXPIRED",
        isClient: true,
        isProvider: false,
        settlementPending: false,
      }).heading,
    ).toMatch(/venció/i);
  });

  it("J1c: devoluciones explican el estado final sin plazos ni CTA", () => {
    for (const status of ["REFUNDED", "PARTIALLY_REFUNDED"] as const) {
      const action = getJobNextAction({
        status,
        isClient: true,
        isProvider: false,
        settlementPending: false,
      });
      expect(action.kind).toBeNull();
      expect(action.href).toBeUndefined();
      expect(action.sub).toMatch(/chat/i);
      expect(action.sub).not.toMatch(/\d+\s*(días|horas)|plazo/i);
    }
    expect(
      getJobNextAction({
        status: "PARTIALLY_REFUNDED",
        isClient: true,
        isProvider: false,
        settlementPending: false,
      }).heading,
    ).toMatch(/parcial/i);
  });

  it("J1d: prestador con cobro online pendiente espera el pago del cliente", () => {
    const action = getJobNextAction({
      status: "COMPLETED",
      isClient: false,
      isProvider: true,
      settlementPending: true,
      paymentsEnabled: true,
    });
    expect(action.kind).toBeNull();
    expect(action.heading).toMatch(/esperando el pago del cliente/i);
  });

  it("J1e: disputa cuenta la revisión en curso y deriva al chat", () => {
    const action = getJobNextAction({
      status: "DISPUTED",
      isClient: true,
      isProvider: false,
      settlementPending: false,
    });
    expect(action.kind).toBeNull();
    expect(action.heading).toMatch(/revisión/i);
    expect(action.sub).toMatch(/chat/i);
  });

  it("J1f: pago externo declarado se refleja con ancla a #pago", () => {
    const counterpart = getJobNextAction({
      status: "COMPLETED",
      isClient: true,
      isProvider: false,
      settlementPending: true,
      externalPaymentPending: { amountMinor: 150000, declaredByMe: false },
    });
    expect(counterpart.kind).toBeNull();
    expect(counterpart.heading).toMatch(/\$1\.500/);
    expect(counterpart.href).toBe("#pago");
    expect(counterpart.sub).toMatch(/confirmalo|avisá/i);
    const declarant = getJobNextAction({
      status: "COMPLETED",
      isClient: false,
      isProvider: true,
      settlementPending: true,
      externalPaymentPending: { amountMinor: 150000, declaredByMe: true },
    });
    expect(declarant.heading).toMatch(/declaraste/i);
    expect(declarant.href).toBe("#pago");
    expect(declarant.sub).toMatch(/esperando|anular/i);
  });

  it("J1g: corrección pedida muestra el motivo y ancla a la entrega", () => {
    const withReason = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      modality: "IN_PERSON",
      deliverySubmitted: true,
      correctionCount: 1,
      correctionReason: "Falta pintar el marco",
    });
    expect(withReason.kind).toBeNull();
    expect(withReason.heading).toMatch(/corrección/i);
    expect(withReason.sub).toContain("Falta pintar el marco");
    expect(withReason.href).toBe("#entrega");
    const withoutReason = getJobNextAction({
      status: "IN_PROGRESS",
      isClient: false,
      isProvider: true,
      settlementPending: false,
      correctionCount: 2,
    });
    expect(withoutReason.heading).toMatch(/corrección/i);
    expect(withoutReason.href).toBe("#entrega");
  });

  it("J1h: cliente con ambas modalidades enlaza al formulario", () => {
    const action = getJobNextAction({
      status: "CONFIRMED",
      isClient: true,
      isProvider: false,
      settlementPending: false,
      modality: "BOTH",
      deliveryFlowAvailable: true,
    });
    expect(action.kind).toBeNull();
    expect(action.href).toBe("#modalidad");
    expect(action.hrefLabel).toMatch(/elegir modalidad/i);
  });
});
