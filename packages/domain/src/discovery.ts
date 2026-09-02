import {
  priceModels,
  serviceModalities,
  type PriceModel,
  type ServiceModality,
} from "./marketplace";
import { parseMajorAmountToMinor } from "./money";

export type DiscoverySort =
  | "recommended"
  | "nearest"
  | "price-asc"
  | "price-desc"
  | "best-rated"
  | "most-completed";

export type DiscoveryFilters = {
  modality: ServiceModality | null;
  sort: DiscoverySort;
  page: number;
  pageSize: number;
  minPrice: number | null;
  maxPrice: number | null;
  acceptsOffers: boolean | null;
  priceModel: PriceModel | null;
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
  adjustedRating?: number | null;
  reviewCount?: number;
  completedJobs?: number;
  completionRate?: number | null;
  repeatClientCount?: number;
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
  "best-rated",
  "most-completed",
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

function positiveInternalIntegerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function humanPriceToMinorOrNull(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  try {
    return parseMajorAmountToMinor(value);
  } catch {
    return null;
  }
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

function parsePriceModel(value: string | undefined): PriceModel | null {
  const normalized = value?.toUpperCase();
  return priceModels.includes(normalized as PriceModel)
    ? (normalized as PriceModel)
    : null;
}

function boundedNumber(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

function reputationBonus(signals: DiscoveryRankingSignals): number {
  const reviewCount = Math.floor(boundedNumber(signals.reviewCount, 10_000));
  const rating =
    reviewCount > 0 &&
    typeof signals.adjustedRating === "number" &&
    Number.isFinite(signals.adjustedRating)
      ? Math.max(1, Math.min(5, signals.adjustedRating))
      : null;
  const ratingBonus = rating === null ? 0 : ((rating - 1) / 4) * 0.18;
  const completedBonus =
    Math.min(boundedNumber(signals.completedJobs, 1_000), 20) / 20 * 0.12;
  const completionBonus =
    signals.completionRate === null || signals.completionRate === undefined
      ? 0
      : boundedNumber(signals.completionRate, 1) * 0.08;
  const repeatBonus =
    Math.min(boundedNumber(signals.repeatClientCount, 1_000), 10) / 10 * 0.04;

  return ratingBonus + completedBonus + completionBonus + repeatBonus;
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
  const minPrice = humanPriceToMinorOrNull(params.min);
  const maxPrice = humanPriceToMinorOrNull(params.max);
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
    priceModel: parsePriceModel(params.priceModel),
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

export function parseDiscoveryFiltersFromInternal(
  input: Record<string, unknown>,
): DiscoveryFilters {
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, positiveInternalIntegerOrNull(input.page) ?? 1),
  );
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, positiveInternalIntegerOrNull(input.pageSize) ?? MAX_PAGE_SIZE),
  );
  const radius = positiveInternalIntegerOrNull(input.radiusMeters);
  const modality =
    typeof input.modality === "string" ? parseMode(input.modality) : null;
  const sort =
    typeof input.sort === "string" &&
    SORTS.includes(input.sort as DiscoverySort)
      ? (input.sort as DiscoverySort)
      : "recommended";
  const minPrice = positiveInternalIntegerOrNull(input.minPrice);
  const maxPrice = positiveInternalIntegerOrNull(input.maxPrice);
  const locationSlug =
    typeof input.locationSlug === "string" && input.locationSlug.trim()
      ? input.locationSlug.trim()
      : null;

  return {
    modality,
    sort,
    page,
    pageSize,
    minPrice,
    maxPrice,
    acceptsOffers: input.acceptsOffers === true ? true : null,
    priceModel:
      typeof input.priceModel === "string"
        ? parsePriceModel(input.priceModel)
        : null,
    categorySlug:
      typeof input.categorySlug === "string" && input.categorySlug.trim()
        ? input.categorySlug.trim()
        : null,
    skillSlug:
      typeof input.skillSlug === "string" && input.skillSlug.trim()
        ? input.skillSlug.trim()
        : null,
    locationSlug,
    radiusMeters: radius
      ? Math.min(MAX_RADIUS_METERS, Math.max(100, radius))
      : locationSlug
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
      reputationBonus(signals) +
      (signals.newProviderExposure ? 0.04 : 0)
    ).toFixed(6),
  );
}
