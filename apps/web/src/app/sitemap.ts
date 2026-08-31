import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@changas/config/public";

import { createClient } from "@/lib/supabase/server";
import { collectPaginated } from "@/lib/sitemap/pagination";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [categories, providers, services] = await Promise.all([
    collectPaginated(async (from, to) => {
      const { data } = await supabase
        .from("categories")
        .select("slug, updated_at")
        .eq("is_active", true)
        .range(from, to);
      return data ?? [];
    }),
    collectPaginated(async (from, to) => {
      const { data } = await supabase
        .from("public_provider_profiles")
        .select("public_slug")
        .range(from, to);
      return data ?? [];
    }),
    collectPaginated(async (from, to) => {
      const { data } = await supabase
        .from("public_provider_services")
        .select("provider_slug, public_slug")
        .range(from, to);
      return data ?? [];
    }),
  ]);
  const baseUrl = getPublicSiteUrl();

  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
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
  ];
}
