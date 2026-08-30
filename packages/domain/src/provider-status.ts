export const providerStatuses = [
  "NOT_STARTED",
  "PROFILE_INCOMPLETE",
  "IDENTITY_PENDING",
  "UNDER_REVIEW",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
  "RESTRICTED",
  "DEACTIVATED",
] as const;

export type ProviderStatus = (typeof providerStatuses)[number];

const selfManageableStatuses = new Set<ProviderStatus>([
  "PROFILE_INCOMPLETE",
  "IDENTITY_PENDING",
]);

export function canSelfManageProviderStatus(status: ProviderStatus): boolean {
  return selfManageableStatuses.has(status);
}
