import { describe, expect, it } from "vitest";

import {
  buildSitemapChunkPlans,
  SITEMAP_URL_LIMIT,
  totalSitemapUrls,
  type SitemapCounts,
  type SitemapRange,
} from "./pagination";

function appendRange(
  values: string[],
  prefix: string,
  range: SitemapRange,
): void {
  if (!range) return;
  for (let index = range.from; index <= range.to; index++) {
    values.push(`${prefix}:${index}`);
  }
}

function materializePlans(counts: SitemapCounts): string[] {
  const values: string[] = [];
  for (const plan of buildSitemapChunkPlans(counts)) {
    if (plan.includeHome) values.push("home");
    appendRange(values, "category", plan.categories);
    appendRange(values, "provider", plan.providers);
    appendRange(values, "service", plan.services);
  }
  return values;
}

describe("sitemap chunk planning", () => {
  it("splits more than 50,000 URLs without gaps or duplicates", () => {
    const counts = { categories: 8, providers: 2_000, services: 50_001 };
    const plans = buildSitemapChunkPlans(counts);
    const materialized = materializePlans(counts);
    const chunksAreBounded = plans.every(
      (plan) => plan.expectedUrls <= SITEMAP_URL_LIMIT,
    );

    expect(plans.length).toBeGreaterThan(1);
    expect(chunksAreBounded).toBe(true);
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
