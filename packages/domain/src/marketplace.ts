import type { ProviderStatus } from "./provider-status";

export const priceModels = [
  "FIXED",
  "STARTING_AT",
  "HOURLY",
  "PER_UNIT",
  "QUOTE",
] as const;

export type PriceModel = (typeof priceModels)[number];

export const serviceModalities = ["IN_PERSON", "REMOTE", "BOTH"] as const;

export type ServiceModality = (typeof serviceModalities)[number];

export const scheduleTypes = [
  "FIXED_SLOT",
  "FLEXIBLE_WINDOW",
  "DEADLINE",
  "UNSCHEDULED",
] as const;

export type ScheduleType = (typeof scheduleTypes)[number];

export function canPublishProviderOffering(input: {
  status: ProviderStatus;
  providerPaused: boolean;
}): boolean {
  return input.status === "ACTIVE" && !input.providerPaused;
}
