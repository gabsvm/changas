import { describe, expect, it } from "vitest";

import { parseJobPostForm } from "./job-post-input";

const BASE = {
  skillId: "11111111-1111-4111-8111-111111111111",
  title: "Necesito plomero urgente en casa",
  description:
    "Se rompio un cano bajo la bacha de la cocina y necesito el arreglo esta semana.",
  locationText: "Palermo, CABA",
  scheduleStartAt: "",
  scheduleEndAt: "",
  desiredBudgetAmount: "",
};

describe("parseJobPostForm", () => {
  it("acepta una necesidad valida con opcionales vacios", () => {
    const parsed = parseJobPostForm({ ...BASE, locationText: "" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.title).toBe(BASE.title);
      expect(parsed.data.locationText).toBeUndefined();
      expect(parsed.data.desiredBudgetAmount).toBeUndefined();
    }
  });

  it("rechaza titulo corto con mensaje rioplatense", () => {
    const parsed = parseJobPostForm({ ...BASE, title: "Corto" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/10 y 120/);
  });

  it("rechaza descripcion corta", () => {
    const parsed = parseJobPostForm({ ...BASE, description: "Muy corta." });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/20 caracteres/);
  });

  it("exige rubro del catalogo", () => {
    const parsed = parseJobPostForm({ ...BASE, skillId: "" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/rubro/);
  });

  it("rechaza ubicacion de un caracter", () => {
    const parsed = parseJobPostForm({ ...BASE, locationText: "X" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/[Uu]bicaci/);
  });

  it("rechaza presupuesto no positivo", () => {
    const parsed = parseJobPostForm({ ...BASE, desiredBudgetAmount: "-500" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/presupuesto/);
  });

  it("acepta presupuesto con coma decimal", () => {
    const parsed = parseJobPostForm({
      ...BASE,
      desiredBudgetAmount: "80.000,50",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.desiredBudgetAmount).toBe(8000050);
  });

  it("rechaza ventana invertida", () => {
    const parsed = parseJobPostForm({
      ...BASE,
      scheduleStartAt: "2030-05-10T12:00",
      scheduleEndAt: "2030-05-10T10:00",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/posterior al inicio/);
  });

  it("rechaza fecha invalida", () => {
    const parsed = parseJobPostForm({
      ...BASE,
      scheduleStartAt: "no-es-fecha",
      scheduleEndAt: "",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/fecha/);
  });

  it("acepta ventana completa valida", () => {
    const parsed = parseJobPostForm({
      ...BASE,
      scheduleStartAt: "2030-05-10T10:00",
      scheduleEndAt: "2030-05-10T12:00",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.scheduleStartAt).toBeInstanceOf(Date);
      expect(parsed.data.scheduleEndAt).toBeInstanceOf(Date);
    }
  });
});
