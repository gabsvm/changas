import { describe, expect, it } from "vitest";

import { getNotificationKindLabel } from "./notifications";

describe("getNotificationKindLabel", () => {
  it.each([
    ["MESSAGE", "Mensajes"],
    ["PROPOSAL", "Propuestas"],
    ["PAYMENT", "Pagos"],
    ["JOB", "Trabajos"],
    ["REVIEW", "Reseñas"],
    ["VERIFICATION", "Verificación"],
    ["SECURITY", "Seguridad"],
    ["MODERATION", "Moderación"],
  ] as const)("maps %s to human copy", (kind, label) => {
    expect(getNotificationKindLabel(kind)).toBe(label);
  });

  it("falls back safely for an unknown value", () => {
    expect(getNotificationKindLabel("UNKNOWN")).toBe("Actividad");
  });
});
