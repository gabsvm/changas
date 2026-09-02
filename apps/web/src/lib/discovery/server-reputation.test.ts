import { describe, expect, it } from "vitest";

import { safeDiscoveryRows } from "./server";

const baseRow = {
  provider_display_name: "Proveedor",
  provider_avatar_url: null,
  provider_slug: "proveedor",
  provider_zone: "CABA",
  service_title: "Servicio",
  service_slug: "servicio",
  category_slug: "hogar",
  category_name: "Hogar",
  skill_slug: "electricidad",
  skill_name: "Electricidad",
  modality: "IN_PERSON",
  price_model: "FIXED",
  price_amount: 100000,
  currency_code: "ARS",
  price_unit: null,
  accepts_offers: false,
  distance_bucket: null,
  relevance: 1,
  has_more: false,
} as const;

describe("Phase 07 discovery reputation boundary", () => {
  it("rejects legacy V3 rows that omit reputation signals", () => {
    expect(safeDiscoveryRows([baseRow])).toEqual([]);
  });

  it("accepts the V4 public reputation projection", () => {
    const row = {
      ...baseRow,
      rating_average: 4.8,
      adjusted_rating: 4.6,
      review_count: 12,
      completed_jobs: 18,
      completion_rate: 0.9,
      repeat_client_count: 4,
    };

    expect(safeDiscoveryRows([row])).toEqual([row]);
  });
});
