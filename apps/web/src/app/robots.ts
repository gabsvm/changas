import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@changas/config/public";

import { buildSitemapChunkPlans } from "@/lib/sitemap/pagination";
import { loadSitemapCounts } from "@/lib/sitemap/server";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = getPublicSiteUrl();
  const counts = await loadSitemapCounts();
  const sitemaps = buildSitemapChunkPlans(counts).map(
    ({ id }) => `${baseUrl}/sitemap/${id}.xml`,
  );
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/provider/", "/api/", "/auth/"],
    },
    sitemap: sitemaps,
  };
}
