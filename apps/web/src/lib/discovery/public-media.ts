import { getPublicSiteUrl } from "@changas/config/public";

export function isTrustedPublicAvatarUrl(
  value: string | null,
): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const origin = new URL(getPublicSiteUrl()).origin;
    return url.origin === origin && url.pathname.startsWith("/api/avatar/");
  } catch {
    return false;
  }
}
