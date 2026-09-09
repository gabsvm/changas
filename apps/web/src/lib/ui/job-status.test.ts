import { describe, expect, it } from "vitest";

import { getJobStatusPresentation } from "./job-status";

describe("getJobStatusPresentation", () => {
  it("humanizes active job states", () => {
    expect(getJobStatusPresentation("CONFIRMED")).toMatchObject({
      label: "Confirmado",
      tone: "info",
    });
    expect(getJobStatusPresentation("IN_PROGRESS")).toMatchObject({
      label: "En curso",
      tone: "brand",
    });
    expect(getJobStatusPresentation("COMPLETION_REQUESTED").label).toBe(
      "Pendiente de cierre",
    );
  });

  it("humanizes terminal and exceptional states", () => {
    expect(getJobStatusPresentation("COMPLETED").label).toBe("Completado");
    expect(getJobStatusPresentation("PARTIALLY_REFUNDED").label).toBe(
      "Reembolso parcial",
    );
    expect(getJobStatusPresentation("NO_SHOW").label).toBe("No se presentó");
  });

  it("does not leak unknown raw enum values", () => {
    expect(getJobStatusPresentation("SOMETHING_NEW").label).toBe(
      "Estado del trabajo",
    );
  });
});
