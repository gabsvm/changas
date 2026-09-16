import { describe, expect, it } from "vitest";

import { parseServiceForm, type ServiceFormRaw } from "./service-input";

const SKILL_ID = "123e4567-e89b-12d3-a456-426614174000";

function raw(overrides: Partial<ServiceFormRaw> = {}): ServiceFormRaw {
  return {
    skillId: SKILL_ID,
    title: "Reparación de PC a domicilio",
    description: "Diagnóstico completo y reparación de computadoras a domicilio.",
    modality: "IN_PERSON",
    priceModel: "FIXED",
    priceAmount: "30000",
    currencyCode: "ARS",
    priceUnit: "",
    acceptsOffers: false,
    expectedDurationMinutes: undefined,
    scheduleType: "UNSCHEDULED",
    includes: "",
    excludes: "",
    materialsNotes: "",
    isPublished: true,
    isPaused: false,
    tags: [],
    ...overrides,
  };
}

describe("parseServiceForm", () => {
  it("acepta un servicio válido", () => {
    const result = parseServiceForm(raw());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priceAmount).toBe(3_000_000);
  });

  it("descarta la unidad residual si el modelo no es por unidad", () => {
    const result = parseServiceForm(raw({ priceUnit: "hora" }));
    expect(result.ok).toBe(true);
  });

  it("descarta el monto residual en “a cotizar”", () => {
    const result = parseServiceForm(
      raw({ priceModel: "QUOTE", priceAmount: "5000" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priceAmount).toBeUndefined();
  });

  it("acepta coma decimal es-AR", () => {
    const result = parseServiceForm(raw({ priceAmount: "1500,50" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priceAmount).toBe(150_050);
  });

  it("explica el título corto en lugar del error genérico", () => {
    const result = parseServiceForm(raw({ title: "PC" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("título");
  });

  it("explica la habilidad faltante", () => {
    const result = parseServiceForm(raw({ skillId: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("habilidad");
  });

  it("exige unidad en precio por unidad", () => {
    const result = parseServiceForm(
      raw({ priceModel: "PER_UNIT", priceUnit: "" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("unidad");
  });

  it("exige monto en modelos con precio", () => {
    const result = parseServiceForm(raw({ priceAmount: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("monto");
  });
});
