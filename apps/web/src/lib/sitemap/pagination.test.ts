import { describe, expect, it } from "vitest";

import {
  buildSitemapChunkPlans,
  SITEMAP_URL_LIMIT,
  totalSitemapUrls,
  type SitemapCounts,
} from "./pagination";

function materializePlans(counts: SitemapCounts): string[] {
  const values: string[] = [];
  for (const plan of buildSitemapChunkPlans(counts)) {
    if (plan.includeHome) values.push("home");
    if (plan.categories) {
      for (let index = plan.categories.from; index <= plan.categories.to; index++) {
        values.push(`category:${index}`);
      }
    }
    if (plan.providers) {
      for (let index = plan.providers.from; index <= plan.providers.to; index++) {
        values.push(`provider:${index}`);
      }
    }
    if (plan.services) {
      for (let index = plan.services.from; index <= plan.services.to; index++) {
        values.push(`service:${index}`);
      }
    }
  }
  return values;
}

describe("sitemap chunk planning", () => {
  it("splits more than 50,000 URLs without gaps or duplicates", () => {
    const counts = { categories: 8, providers: 2_000, services: 50_001 };
    const plans = buildSitemapChunkPlans(counts);
    const materialized = materializePlans(counts);

    expect(plans.length).toBeGreaterThan(1);
    expect(plans.every((plan) => plan.expectedUrls <= SITEMAP_URL_LIMIT)).toBe(
      true,
    );
    expect(materialized).toHaveLength(totalSitemapUrls(counts));
    expect(new Set(materialized).size).toBe(materialized.length);
  });

  it("keeps a deterministic global order across chunk boundaries", () => {
    const counts = { categories: 2, providers: 2, services: 3 };
    expect(materializePlans(counts)).toEqual([
      "home",
      "category:0",
      "category:1",
      "provider:0",
      "provider:1",
      "service:0",
      "service:1",
      "service:2",
    ]);
  });
});
