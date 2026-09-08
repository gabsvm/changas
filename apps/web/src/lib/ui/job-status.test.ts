import { describe, expect, it } from "vitest";

import { getJobStatusLabel } from "./job-status";

describe("getJobStatusLabel", () => {
  it.each([
    ["CONFIRMED", "Confirmado"],
    ["IN_PROGRESS", "En curso"],
    ["COMPLETION_REQUESTED", "Esperando confirmación"],
    ["COMPLETED", "Completado"],
    ["CANCELLED", "Cancelado"],
    ["DISPUTED", "En disputa"],
    ["REFUNDED", "Reintegrado"],
    ["PARTIALLY_REFUNDED", "Reintegro parcial"],
    ["EXPIRED", "Vencido"],
    ["NO_SHOW", "Ausencia reportada"],
  ])("maps %s to %s", (status, label) => {
    expect(getJobStatusLabel(status)).toBe(label);
  });

  it("falls back to readable copy for unknown values", () => {
    expect(getJobStatusLabel("SOMETHING_NEW")).toBe("Something new");
  });
});
