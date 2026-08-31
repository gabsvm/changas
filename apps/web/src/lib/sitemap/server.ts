import { createClient } from "@/lib/supabase/server";

import type { SitemapCounts } from "./pagination";

export async function loadSitemapCounts(): Promise<SitemapCounts> {
  const supabase = await createClient();
  const [categories, providers, services] = await Promise.all([
    supabase
      .from("categories")
      .select("slug", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("public_provider_profiles")
      .select("public_slug", { count: "exact", head: true }),
    supabase
      .from("public_provider_services")
      .select("public_slug", { count: "exact", head: true }),
  ]);

  if (categories.error || providers.error || services.error) {
    throw new Error("No pudimos calcular el contenido público del sitemap.");
  }

  return {
    categories: categories.count ?? 0,
    providers: providers.count ?? 0,
    services: services.count ?? 0,
  };
}
