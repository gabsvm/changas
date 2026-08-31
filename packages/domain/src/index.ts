export type JsonPrimitive = boolean | number | string | null;

export type JsonObject = { [key: string]: JsonValue };

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export {
  canSelfManageProviderStatus,
  providerStatuses,
  type ProviderStatus,
} from "./provider-status";
export {
  canPublishProviderOffering,
  priceModels,
  scheduleTypes,
  serviceModalities,
  type PriceModel,
  type ScheduleType,
  type ServiceModality,
} from "./marketplace";
export {
  formatMinorUnits,
  formatServicePrice,
  minorUnitsToMajorInput,
  parseMajorAmountToMinor,
  parseServicePrice,
  supportedCurrencyCodes,
  type CurrencyCode,
} from "./money";
export {
  normalizeDiscoveryQuery,
  parseDiscoveryFilters,
  rankDiscoveryResult,
  type DiscoveryFilters,
  type DiscoveryRankingSignals,
  type DiscoverySort,
} from "./discovery";
export {
  getManualLocation,
  manualLocations,
  type ManualLocation,
} from "./location";
