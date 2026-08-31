import { describe, expect, it } from "vitest";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
  rankDiscoveryResult,
} from "./discovery";

describe("discovery domain helpers", () => {
  it("normalizes Spanish search text deterministically", () => {
    expect(normalizeDiscoveryQuery("  ClÁSES   de Inglés ")).toBe(
      "clases de ingles",
    );
    expect(normalizeDiscoveryQuery("PC\tse\napaga")).toBe("pc se apaga");
  });

  it("parses and bounds URL-addressable discovery filters", () => {
    expect(
      parseDiscoveryFilters({
        mode: "remoto",
        sort: "price-asc",
        page: "0",
        pageSize: "999",
        min: "1000",
        max: "5000",
        offers: "true",
        priceModel: "hourly",
      }),
    ).toEqual({
      modality: "REMOTE",
      sort: "price-asc",
      page: 1,
      pageSize: 24,
      minPrice: 1000,
      maxPrice: 5000,
      acceptsOffers: true,
      priceModel: "HOURLY",
      categorySlug: null,
      skillSlug: null,
      locationSlug: null,
      radiusMeters: null,
    });
  });

  it("gives exact skill and synonym matches a deterministic advantage", () => {
    const exact = rankDiscoveryResult({
      textRelevance: 0.8,
      exactSkillMatch: true,
      exactCategoryMatch: false,
      tagMatch: true,
      synonymMatch: true,
      distanceMeters: 1500,
    });
    const distantTextOnly = rankDiscoveryResult({
      textRelevance: 0.8,
      exactSkillMatch: false,
      exactCategoryMatch: false,
      tagMatch: false,
      synonymMatch: false,
      distanceMeters: 500,
    });

    expect(exact).toBeGreaterThan(distantTextOnly);
    expect(
      rankDiscoveryResult({
        textRelevance: 0,
        exactSkillMatch: false,
        exactCategoryMatch: false,
        tagMatch: false,
        synonymMatch: false,
        distanceMeters: null,
      }),
    ).toBe(0);
  });
});
