type DeletionUser = {
  identities?: ReadonlyArray<{ provider: string }> | null | undefined;
  app_metadata?: { provider?: unknown; providers?: unknown } | null | undefined;
};

// Only accounts with an email identity own a password that can be re-checked.
// OAuth-only accounts (Google) have none, so the typed ELIMINAR phrase is
// their confirmation step.
export function requiresPasswordConfirmation(
  user: DeletionUser | null | undefined,
): boolean {
  if (!user) return false;
  if (user.identities?.some((identity) => identity.provider === "email")) {
    return true;
  }
  const metadata = user.app_metadata;
  if (metadata?.provider === "email") return true;
  return (
    Array.isArray(metadata?.providers) && metadata.providers.includes("email")
  );
}
