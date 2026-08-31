import { getPublicSiteUrl } from "@changas/config/public";

import { buildSitemapChunkPlans } from "@/lib/sitemap/pagination";
import { loadSitemapChunk, loadSitemapCounts } from "@/lib/sitemap/server";
import { renderSitemapUrlSet, type SitemapUrl } from "@/lib/sitemap/xml";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedId = Number((await params).id);
  if (!Number.isInteger(resolvedId) || resolvedId < 0) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const counts = await loadSitemapCounts();
    const plan = buildSitemapChunkPlans(counts).find(
      (candidate) => candidate.id === resolvedId,
    );
    if (!plan) return new Response("Not found", { status: 404 });

    const data = await loadSitemapChunk(plan);
    const baseUrl = getPublicSiteUrl();
    const urls: SitemapUrl[] = [];

    if (plan.includeHome) {
      urls.push({ loc: baseUrl, changeFrequency: "daily", priority: 1 });
    }
    urls.push(
      ...data.categories.map((category) => ({
        loc: `${baseUrl}/categoria/${category.slug}`,
        lastModified: category.updated_at,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...data.providers.map((provider) => ({
        loc: `${baseUrl}/p/${provider.public_slug}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...data.services.map((service) => ({
        loc: `${baseUrl}/p/${service.provider_slug}/${service.public_slug}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    );

    if (urls.length !== plan.expectedUrls) {
      return new Response("Sitemap changed while generating", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response(renderSitemapUrlSet(urls), {
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
