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
  // Rejected providers must be able to fix their case and resubmit;
  // status flips stay server-side (trigger + submit RPC).
  "REJECTED",
]);

export function canSelfManageProviderStatus(status: ProviderStatus): boolean {
  return selfManageableStatuses.has(status);
}
