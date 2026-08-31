import {
  getManualLocation,
  type DiscoveryFilters,
  type DiscoverySort,
} from "@changas/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import type {
  Database,
  DiscoveryServiceRow,
  ServiceModalityType,
} from "../supabase/database.types";

export type DiscoverySearchInput = {
  query: string;
  filters: DiscoveryFilters;
  latitude?: number | null;
  longitude?: number | null;
};

export type DiscoverySearchResult = {
  rows: DiscoveryServiceRow[];
  error: string | null;
};

type DiscoveryClient = SupabaseClient<Database>;

function rpcModality(
  modality: DiscoveryFilters["modality"],
): ServiceModalityType | undefined {
  return modality ?? undefined;
}

export async function searchDiscovery(
  input: DiscoverySearchInput,
  client?: DiscoveryClient,
): Promise<DiscoverySearchResult> {
  const supabase = client ?? (await createClient());
  const manualLocation = getManualLocation(input.filters.locationSlug);
  const latitude = input.latitude ?? manualLocation?.latitude ?? null;
  const longitude = input.longitude ?? manualLocation?.longitude ?? null;
  const args: Database["public"]["Functions"]["search_discovery_services"]["Args"] =
    {
      page_number: input.filters.page,
      page_size: input.filters.pageSize,
      sort_key: input.filters.sort as DiscoverySort,
    };
  if (input.filters.acceptsOffers !== null) {
    args.accepts_offers_filter = input.filters.acceptsOffers;
  }
  if (input.filters.categorySlug)
    args.category_filter = input.filters.categorySlug;
  if (input.filters.maxPrice !== null) args.max_price = input.filters.maxPrice;
  if (input.filters.minPrice !== null) args.min_price = input.filters.minPrice;
  const modality = rpcModality(input.filters.modality);
  if (modality) args.modality_filter = modality;
  if (latitude !== null && longitude !== null) {
    args.origin_lat = latitude;
    args.origin_lng = longitude;
  }
  if (input.query) args.query_text = input.query;
  if (input.filters.radiusMeters !== null) {
    args.radius_meters = input.filters.radiusMeters;
  }
  if (input.filters.skillSlug) args.skill_filter = input.filters.skillSlug;

  const { data, error } = await supabase.rpc("search_discovery_services", args);

  return {
    rows: data ?? [],
    error: error?.message ?? null,
  };
}

export function isValidCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

export function safeDiscoveryRows(value: unknown): DiscoveryServiceRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is DiscoveryServiceRow => {
    if (!row || typeof row !== "object") return false;
    const candidate = row as Partial<DiscoveryServiceRow>;
    return (
      typeof candidate.provider_display_name === "string" &&
      typeof candidate.provider_slug === "string" &&
      typeof candidate.service_title === "string" &&
      typeof candidate.service_slug === "string" &&
      typeof candidate.category_slug === "string" &&
      typeof candidate.skill_slug === "string" &&
      typeof candidate.modality === "string" &&
      typeof candidate.price_model === "string" &&
      typeof candidate.currency_code === "string" &&
      typeof candidate.accepts_offers === "boolean"
    );
  });
}
