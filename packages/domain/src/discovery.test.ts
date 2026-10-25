import { describe, expect, it } from "vitest";

import {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
  parseDiscoveryFiltersFromInternal,
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

  it("accepts reputation-aware discovery sorts", () => {
    expect(parseDiscoveryFilters({ sort: "best-rated" }).sort).toBe(
      "best-rated",
    );
    expect(parseDiscoveryFilters({ sort: "most-completed" }).sort).toBe(
      "most-completed",
    );
    expect(parseDiscoveryFiltersFromInternal({ sort: "best-rated" }).sort).toBe(
      "best-rated",
    );
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
});
