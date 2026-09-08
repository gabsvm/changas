import { describe, expect, it } from "vitest";

import type { DiscoveryFilters } from "@changas/domain";

import { countActiveDiscoveryFilters } from "./discovery-filters";

const defaults: DiscoveryFilters = {
  modality: null,
  sort: "recommended",
  page: 1,
  pageSize: 24,
  minPrice: null,
  maxPrice: null,
  acceptsOffers: null,
  priceModel: null,
  categorySlug: null,
  skillSlug: null,
  locationSlug: null,
  radiusMeters: null,
};

describe("countActiveDiscoveryFilters", () => {
  it("does not count pagination, the visible location field, or its default radius", () => {
    expect(
      countActiveDiscoveryFilters({
        ...defaults,
        page: 3,
        locationSlug: "palermo",
        radiusMeters: 10_000,
      }),
    ).toBe(0);
  });

  it("counts each meaningful advanced filter", () => {
    expect(
      countActiveDiscoveryFilters({
        ...defaults,
        modality: "REMOTE",
        sort: "best-rated",
        minPrice: 10_000,
        maxPrice: 40_000,
        acceptsOffers: true,
        priceModel: "FIXED",
        categorySlug: "hogar",
        skillSlug: "electricidad",
        radiusMeters: 25_000,
      }),
    ).toBe(9);
  });
});
