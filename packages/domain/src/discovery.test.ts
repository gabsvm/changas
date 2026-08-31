import { describe, expect, it } from "vitest";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
  parseDiscoveryFiltersFromInternal,
  rankDiscoveryResult,
} from "./discovery";
import { adjustedRating as adjustedRatingPublic } from "./discovery-public";

describe("discovery domain helpers", () => {
  it("computes a bounded statistically adjusted rating placeholder", () => {
    expect(adjustedRatingPublic(5, 1, 3, 10)).toBeCloseTo(3.1818, 4);
    expect(() => adjustedRatingPublic(6, 1, 3, 10)).toThrow();
    expect(() => adjustedRatingPublic(4, -1, 3, 10)).toThrow();
  });
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
        min: "8000",
        max: "10000",
        offers: "true",
        priceModel: "hourly",
      }),
    ).toEqual({
      modality: "REMOTE",
      sort: "price-asc",
      page: 1,
      pageSize: 24,
      minPrice: 800000,
      maxPrice: 1000000,
      acceptsOffers: true,
      priceModel: "HOURLY",
      categorySlug: null,
      skillSlug: null,
      locationSlug: null,
      radiusMeters: null,
    });
  });

  it("keeps internal geolocation filters in minor units without converting twice", () => {
    expect(
      parseDiscoveryFiltersFromInternal({
        minPrice: 900000,
        maxPrice: 1000000,
        modality: "REMOTE",
        page: 2,
      }),
    ).toMatchObject({
      minPrice: 900000,
      maxPrice: 1000000,
      modality: "REMOTE",
      page: 2,
    });
  });

  it("rejects invalid, negative, and overflowing human price URL values", () => {
    expect(parseDiscoveryFilters({ min: "-1" }).minPrice).toBeNull();
    expect(parseDiscoveryFilters({ min: "abc" }).minPrice).toBeNull();
    expect(parseDiscoveryFilters({ min: "90071992547409.92" }).minPrice).toBe(
      null,
    );
    expect(parseDiscoveryFilters({ min: "1.234" }).minPrice).toBeNull();
    expect(
      parseDiscoveryFiltersFromInternal({ minPrice: -1, maxPrice: 2 }),
    ).toMatchObject({ minPrice: null, maxPrice: 2 });
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

  it("keeps the new-provider exposure signal modest and subordinate to relevance", () => {
    const establishedRelevant = rankDiscoveryResult({
      textRelevance: 0.8,
      exactSkillMatch: false,
      exactCategoryMatch: false,
      tagMatch: false,
      synonymMatch: false,
      distanceMeters: null,
    });
    const newBarelyRelevant = rankDiscoveryResult({
      textRelevance: 0.77,
      exactSkillMatch: false,
      exactCategoryMatch: false,
      tagMatch: false,
      synonymMatch: false,
      distanceMeters: null,
      newProviderExposure: true,
    });
    const established = rankDiscoveryResult({
      textRelevance: 0.4,
      exactSkillMatch: false,
      exactCategoryMatch: false,
      tagMatch: false,
      synonymMatch: false,
      distanceMeters: null,
    });
    const newProvider = rankDiscoveryResult({
      textRelevance: 0.4,
      exactSkillMatch: false,
      exactCategoryMatch: false,
      tagMatch: false,
      synonymMatch: false,
      distanceMeters: null,
      newProviderExposure: true,
    });

    expect(establishedRelevant).toBeGreaterThan(newBarelyRelevant);
    expect(newProvider - established).toBeCloseTo(0.04, 6);
  });
});
