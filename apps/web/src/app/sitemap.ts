import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@changas/config/public";

import {
  buildSitemapChunkPlans,
  type SitemapRange,
} from "@/lib/sitemap/pagination";
import { loadSitemapCounts } from "@/lib/sitemap/server";
import { createClient } from "@/lib/supabase/server";

type SitemapClient = Awaited<ReturnType<typeof createClient>>;

async function loadCategories(client: SitemapClient, range: SitemapRange) {
  if (!range) return [];
  const { data, error } = await client
    .from("categories")
    .select("slug, updated_at")
    .eq("is_active", true)
    .order("slug", { ascending: true })
    .range(range.from, range.to);
  if (error) throw new Error("No pudimos generar el sitemap de categorías.");
  return data ?? [];
}

async function loadProviders(client: SitemapClient, range: SitemapRange) {
  if (!range) return [];
  const { data, error } = await client
    .from("public_provider_profiles")
    .select("public_slug")
    .order("public_slug", { ascending: true })
    .range(range.from, range.to);
  if (error) throw new Error("No pudimos generar el sitemap de proveedores.");
  return data ?? [];
}

async function loadServices(client: SitemapClient, range: SitemapRange) {
  if (!range) return [];
  const { data, error } = await client
    .from("public_provider_services")
    .select("provider_slug, public_slug")
    .order("provider_slug", { ascending: true })
    .order("public_slug", { ascending: true })
    .range(range.from, range.to);
  if (error) throw new Error("No pudimos generar el sitemap de servicios.");
  return data ?? [];
}

export async function generateSitemaps() {
  const counts = await loadSitemapCounts();
  return buildSitemapChunkPlans(counts).map(({ id }) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const resolvedId = Number(await id);
  if (!Number.isInteger(resolvedId) || resolvedId < 0) return [];

  const counts = await loadSitemapCounts();
  const plan = buildSitemapChunkPlans(counts).find(
    (candidate) => candidate.id === resolvedId,
  );
  if (!plan) return [];

  const client = await createClient();
  const [categories, providers, services] = await Promise.all([
    loadCategories(client, plan.categories),
    loadProviders(client, plan.providers),
    loadServices(client, plan.services),
  ]);
  const baseUrl = getPublicSiteUrl();
  const urls: MetadataRoute.Sitemap = [];

  if (plan.includeHome) {
    urls.push({ url: baseUrl, changeFrequency: "daily", priority: 1 });
  }
  urls.push(
    ...categories.map((category) => ({
      url: baseUrl + "/categoria/" + category.slug,
      lastModified: category.updated_at,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...providers.map((provider) => ({
      url: baseUrl + "/p/" + provider.public_slug,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...services.map((service) => ({
      url: baseUrl + "/p/" + service.provider_slug + "/" + service.public_slug,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  );

  if (urls.length !== plan.expectedUrls) {
    throw new Error("El sitemap cambió mientras se generaba; reintentá la solicitud.");
  }
  return urls;
}
