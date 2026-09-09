import { getPublicSiteUrl } from "@changas/config/public";

export function isTrustedPublicAvatarUrl(
  value: string | null,
): value is string {
  if (!value) return false;
  if (value.startsWith("/api/avatar/")) return true;

  try {
    const url = new URL(value);
    const origin = new URL(getPublicSiteUrl()).origin;
    return url.origin === origin && url.pathname.startsWith("/api/avatar/");
  } catch {
    return false;
  }
}
