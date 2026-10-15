import "server-only";

/** Rollout gate: default OFF until S1/S2 migrations and E2E pass.
 * This is a UI/server gate, not a substitute for DB-level RLS/RPC checks.
 */
export function arePublicNeedsEnabled(): boolean {
  return process.env.YALO_PUBLIC_NEEDS_ENABLED === "true";
}
