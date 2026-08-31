import { getPublicSiteUrl } from "@changas/config/public";

import { buildSitemapChunkPlans } from "@/lib/sitemap/pagination";
import { loadSitemapCounts } from "@/lib/sitemap/server";
import { renderSitemapIndex } from "@/lib/sitemap/xml";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseUrl = getPublicSiteUrl();
    const counts = await loadSitemapCounts();
    const sitemapUrls = buildSitemapChunkPlans(counts).map(
      ({ id }) => `${baseUrl}/sitemaps/${id}`,
    );
    return new Response(renderSitemapIndex(sitemapUrls), {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch {
    return new Response("Sitemap unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
