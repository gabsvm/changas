import type { DiscoveryFilters } from "@changas/domain";

const DEFAULT_LOCATION_RADIUS_METERS = 10_000;

export function countActiveDiscoveryFilters(filters: DiscoveryFilters): number {
  return [
    filters.modality !== null,
    filters.sort !== "recommended",
    filters.minPrice !== null,
    filters.maxPrice !== null,
    filters.acceptsOffers === true,
    filters.priceModel !== null,
    filters.categorySlug !== null,
    filters.skillSlug !== null,
    filters.radiusMeters !== null &&
      filters.radiusMeters !== DEFAULT_LOCATION_RADIUS_METERS,
  ].filter(Boolean).length;
}
