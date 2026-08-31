import { serviceModalities, type ServiceModality } from "./marketplace";

export type DiscoverySort =
  "recommended" | "nearest" | "price-asc" | "price-desc";

export type DiscoveryFilters = {
  modality: ServiceModality | null;
  sort: DiscoverySort;
  page: number;
  pageSize: number;
  minPrice: number | null;
  maxPrice: number | null;
  acceptsOffers: boolean | null;
  categorySlug: string | null;
  skillSlug: string | null;
  locationSlug: string | null;
  radiusMeters: number | null;
};

export type DiscoveryRankingSignals = {
  textRelevance: number;
  exactSkillMatch: boolean;
  exactCategoryMatch: boolean;
  tagMatch: boolean;
  synonymMatch: boolean;
  distanceMeters: number | null;
  newProviderExposure?: boolean;
};

const MAX_PAGE_SIZE = 24;
const MAX_PAGE = 1000;
const DEFAULT_RADIUS_METERS = 10_000;
const MAX_RADIUS_METERS = 100_000;
const SORTS: DiscoverySort[] = [
  "recommended",
  "nearest",
  "price-asc",
  "price-desc",
];

export function normalizeDiscoveryQuery(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveIntegerOrNull(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMode(value: string | undefined): ServiceModality | null {
  if (value === "presencial") return "IN_PERSON";
  if (value === "remoto") return "REMOTE";
  if (value === "todos") return null;
  if (value === "in_person") return "IN_PERSON";
  if (value === "remote") return "REMOTE";
  if (value === "both") return "BOTH";
  return serviceModalities.includes(value as ServiceModality)
    ? (value as ServiceModality)
    : null;
}

export function parseDiscoveryFilters(
  params: Record<string, string | undefined>,
): DiscoveryFilters {
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, positiveIntegerOrNull(params.page) ?? 1),
  );
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, positiveIntegerOrNull(params.pageSize) ?? MAX_PAGE_SIZE),
  );
  const radius = positiveIntegerOrNull(params.radius);
  const minPrice = positiveIntegerOrNull(params.min);
  const maxPrice = positiveIntegerOrNull(params.max);
  const sort = SORTS.includes(params.sort as DiscoverySort)
    ? (params.sort as DiscoverySort)
    : "recommended";

  return {
    modality: parseMode(params.mode),
    sort,
    page,
    pageSize,
    minPrice,
    maxPrice,
    acceptsOffers: params.offers === "true" ? true : null,
    categorySlug: params.category || null,
    skillSlug: params.skill || null,
    locationSlug: params.location || null,
    radiusMeters: radius
      ? Math.min(MAX_RADIUS_METERS, Math.max(100, radius))
      : params.location
        ? DEFAULT_RADIUS_METERS
        : null,
  };
}

export function rankDiscoveryResult(signals: DiscoveryRankingSignals): number {
  const textRelevance = Math.max(0, Math.min(1, signals.textRelevance));
  const distanceBonus =
    signals.distanceMeters === null
      ? 0
      : Math.max(0, 0.2 - Math.min(signals.distanceMeters, 20_000) / 100_000);

  return Number(
    (
      textRelevance * 1.5 +
      (signals.exactSkillMatch ? 0.45 : 0) +
      (signals.exactCategoryMatch ? 0.25 : 0) +
      (signals.tagMatch ? 0.15 : 0) +
      (signals.synonymMatch ? 0.2 : 0) +
      distanceBonus +
      (signals.newProviderExposure ? 0.04 : 0)
    ).toFixed(6),
  );
}
