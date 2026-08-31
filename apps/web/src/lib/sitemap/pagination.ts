export const SITEMAP_URL_LIMIT = 50_000;

export type SitemapCounts = {
  categories: number;
  providers: number;
  services: number;
};

export type SitemapRange = {
  from: number;
  to: number;
} | null;

export type SitemapChunkPlan = {
  id: number;
  includeHome: boolean;
  categories: SitemapRange;
  providers: SitemapRange;
  services: SitemapRange;
  expectedUrls: number;
};

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function overlapRange(
  chunkStart: number,
  chunkEnd: number,
  sectionStart: number,
  sectionCount: number,
): SitemapRange {
  if (sectionCount === 0) return null;
  const sectionEnd = sectionStart + sectionCount - 1;
  const overlapStart = Math.max(chunkStart, sectionStart);
  const overlapEnd = Math.min(chunkEnd, sectionEnd);
  if (overlapStart > overlapEnd) return null;
  return {
    from: overlapStart - sectionStart,
    to: overlapEnd - sectionStart,
  };
}

function rangeLength(range: SitemapRange): number {
  return range ? range.to - range.from + 1 : 0;
}

export function totalSitemapUrls(counts: SitemapCounts): number {
  assertCount(counts.categories, "categories");
  assertCount(counts.providers, "providers");
  assertCount(counts.services, "services");
  return 1 + counts.categories + counts.providers + counts.services;
}

export function buildSitemapChunkPlans(
  counts: SitemapCounts,
  limit = SITEMAP_URL_LIMIT,
): SitemapChunkPlan[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > SITEMAP_URL_LIMIT) {
    throw new Error("sitemap limit must be a positive protocol-safe integer");
  }

  const total = totalSitemapUrls(counts);
  const chunkCount = Math.max(1, Math.ceil(total / limit));
  const categoriesStart = 1;
  const providersStart = categoriesStart + counts.categories;
  const servicesStart = providersStart + counts.providers;

  return Array.from({ length: chunkCount }, (_, id) => {
    const chunkStart = id * limit;
    const chunkEnd = Math.min(total - 1, chunkStart + limit - 1);
    const categories = overlapRange(
      chunkStart,
      chunkEnd,
      categoriesStart,
      counts.categories,
    );
    const providers = overlapRange(
      chunkStart,
      chunkEnd,
      providersStart,
      counts.providers,
    );
    const services = overlapRange(
      chunkStart,
      chunkEnd,
      servicesStart,
      counts.services,
    );
    const includeHome = chunkStart === 0;
    return {
      id,
      includeHome,
      categories,
      providers,
      services,
      expectedUrls:
        (includeHome ? 1 : 0) +
        rangeLength(categories) +
        rangeLength(providers) +
        rangeLength(services),
    };
  });
}
