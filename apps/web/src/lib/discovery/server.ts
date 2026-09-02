import {
  getManualLocation,
  type DiscoveryFilters,
  type DiscoverySort,
} from "@changas/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import type { ReputationDiscoveryServiceRow } from "./types";
import type { Database, ServiceModalityType } from "../supabase/database.types";

export type DiscoverySearchInput = {
  query: string;
  filters: DiscoveryFilters;
  latitude?: number | null;
  longitude?: number | null;
};

export type DiscoverySearchResult = {
  rows: ReputationDiscoveryServiceRow[];
  hasMore: boolean;
  error: string | null;
};

type DiscoveryClient = SupabaseClient<Database>;
type ReputationDiscoveryRpcClient = {
  rpc(
    name: "search_discovery_services_v4",
    args: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message?: string | null } | null;
  }>;
};

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
  const args: Record<string, unknown> = {
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
  if (input.filters.priceModel !== null) {
    args.price_model_filter = input.filters.priceModel;
  }
  const modality = rpcModality(input.filters.modality);
  if (modality) args.modality_filter = modality;
  if (latitude !== null && longitude !== null) {
    args.origin_lat = latitude;
    args.origin_lng = longitude;
  }
  if (input.query) args.query_text = input.query;
  if (input.filters.radiusMeters !== null) {
    args.radius_meters = input.filters.radiusMeters;
  } else if (latitude !== null && longitude !== null) {
    args.radius_meters = 10_000;
  }
  if (input.filters.skillSlug) args.skill_filter = input.filters.skillSlug;

  const rpcClient = supabase as unknown as ReputationDiscoveryRpcClient;
  const { data, error } = await rpcClient.rpc(
    "search_discovery_services_v4",
    args,
  );
  const rows = safeDiscoveryRows(data);

  return {
    rows,
    hasMore: rows[0]?.has_more ?? false,
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

function nullableFiniteNumber(value: unknown): boolean {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

export function safeDiscoveryRows(
  value: unknown,
): ReputationDiscoveryServiceRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is ReputationDiscoveryServiceRow => {
    if (!row || typeof row !== "object") return false;
    const candidate = row as Partial<ReputationDiscoveryServiceRow>;
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
      typeof candidate.accepts_offers === "boolean" &&
      nullableFiniteNumber(candidate.rating_average) &&
      nullableFiniteNumber(candidate.adjusted_rating) &&
      typeof candidate.review_count === "number" &&
      Number.isFinite(candidate.review_count) &&
      typeof candidate.completed_jobs === "number" &&
      Number.isFinite(candidate.completed_jobs) &&
      nullableFiniteNumber(candidate.completion_rate) &&
      typeof candidate.repeat_client_count === "number" &&
      Number.isFinite(candidate.repeat_client_count) &&
      typeof candidate.has_more === "boolean"
    );
  });
}
