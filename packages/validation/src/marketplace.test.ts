import { describe, expect, it } from "vitest";

import {
  availabilityBlockSchema,
  availabilityRuleSchema,
  educationSchema,
  experienceSchema,
  portfolioSchema,
  serviceAreaSchema,
  serviceSchema,
} from "./index";

const baseService = {
  skillId: "11111111-1111-4111-8111-111111111111",
  title: "Diagnóstico de PC",
  description: "Reviso tu equipo y te explico el problema.",
  modality: "REMOTE" as const,
  priceModel: "FIXED" as const,
  priceAmount: 30000,
  currencyCode: "ARS",
  priceUnit: undefined,
  acceptsOffers: false,
  expectedDurationMinutes: 60,
  scheduleType: "UNSCHEDULED" as const,
  includes: "Diagnóstico y recomendaciones",
  excludes: "Repuestos",
  materialsNotes: "",
  isPublished: false,
  isPaused: false,
};

describe("marketplace validation", () => {
  it("accepts every pricing model and modality", () => {
    for (const priceModel of [
      "FIXED",
      "STARTING_AT",
      "HOURLY",
      "PER_UNIT",
      "QUOTE",
    ] as const) {
      for (const modality of ["IN_PERSON", "REMOTE", "BOTH"] as const) {
        const result = serviceSchema.safeParse({
          ...baseService,
          priceModel,
          modality,
          priceAmount: priceModel === "QUOTE" ? undefined : 12500,
          priceUnit: priceModel === "PER_UNIT" ? "equipo" : undefined,
        });
        expect(result.success, `${priceModel}/${modality}`).toBe(true);
      }
    }
  });

  it("rejects invalid price combinations and publication before activation", () => {
    expect(
      serviceSchema.safeParse({
        ...baseService,
        priceModel: "QUOTE",
        priceAmount: 1000,
      }).success,
    ).toBe(false);
    expect(
      serviceSchema.safeParse({
        ...baseService,
        priceModel: "PER_UNIT",
        priceUnit: undefined,
      }).success,
    ).toBe(false);
    expect(
      serviceSchema.safeParse({
        ...baseService,
        priceAmount: 0,
        isPublished: true,
      }).success,
    ).toBe(false);
  });

  it("bounds professional records, location, and availability ranges", () => {
    expect(
      experienceSchema.safeParse({
        title: "Técnico independiente",
        organization: "",
        description: "Soporte y reparación.",
        startedOn: "2020-01-01",
        endedOn: undefined,
        isCurrent: true,
        isPublic: true,
        sortOrder: 0,
      }).success,
    ).toBe(true);
    expect(
      educationSchema.safeParse({
        institution: "Instituto Técnico",
        fieldOfStudy: "Informática",
        description: "",
        startedOn: "2020-01-01",
        endedOn: "2019-01-01",
        isPublic: false,
        sortOrder: 0,
      }).success,
    ).toBe(false);
    expect(
      portfolioSchema.safeParse({
        title: "Trabajo",
        description: "Antes y después.",
        isPublic: false,
        sortOrder: 0,
      }).success,
    ).toBe(true);
    expect(
      serviceAreaSchema.safeParse({
        label: "Palermo y alrededores",
        radiusMeters: 5000,
        latitude: -34.588,
        longitude: -58.43,
        isActive: true,
      }).success,
    ).toBe(true);
    expect(
      availabilityRuleSchema.safeParse({
        weekday: 1,
        startTime: "09:00",
        endTime: "18:00",
        timezone: "America/Argentina/Buenos_Aires",
        isActive: true,
      }).success,
    ).toBe(true);
    expect(
      availabilityBlockSchema.safeParse({
        startsAt: "2026-09-01T18:00:00Z",
        endsAt: "2026-09-01T17:00:00Z",
        reason: "",
      }).success,
    ).toBe(false);
  });
});
