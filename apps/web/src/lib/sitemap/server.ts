import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@changas/config/public";

import type { Database } from "@/lib/supabase/database.types";

import type {
  SitemapChunkPlan,
  SitemapCounts,
  SitemapRange,
} from "./pagination";

export type SitemapCategoryRow = {
  slug: string;
  updated_at: string;
};

export type SitemapProviderRow = {
  public_slug: string;
};

export type SitemapServiceRow = {
  provider_slug: string;
  public_slug: string;
};

export type SitemapChunkData = {
  categories: SitemapCategoryRow[];
  providers: SitemapProviderRow[];
  services: SitemapServiceRow[];
};

function createPublicSitemapClient(): SupabaseClient<Database> {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function loadSitemapCounts(): Promise<SitemapCounts> {
  const supabase = createPublicSitemapClient();
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

async function loadCategories(
  client: SupabaseClient<Database>,
  range: SitemapRange,
): Promise<SitemapCategoryRow[]> {
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

async function loadProviders(
  client: SupabaseClient<Database>,
  range: SitemapRange,
): Promise<SitemapProviderRow[]> {
  if (!range) return [];
  const { data, error } = await client
    .from("public_provider_profiles")
    .select("public_slug")
    .order("public_slug", { ascending: true })
    .range(range.from, range.to);
  if (error) throw new Error("No pudimos generar el sitemap de proveedores.");
  return data ?? [];
}

async function loadServices(
  client: SupabaseClient<Database>,
  range: SitemapRange,
): Promise<SitemapServiceRow[]> {
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

export async function loadSitemapChunk(
  plan: SitemapChunkPlan,
): Promise<SitemapChunkData> {
  const client = createPublicSitemapClient();
  const [categories, providers, services] = await Promise.all([
    loadCategories(client, plan.categories),
    loadProviders(client, plan.providers),
    loadServices(client, plan.services),
  ]);
  return { categories, providers, services };
}
