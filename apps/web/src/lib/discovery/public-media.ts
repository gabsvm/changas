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

export function isValidPortfolioMediaPath(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > 500) return false;
  if (value.startsWith("/") || value.includes("\\")) return false;
  if (value.includes("..")) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 32 || code === 127 || code === 160) return false;
  }
  return true;
}

export function portfolioPublicUrl(mediaPath: string): string {
  return `/api/portfolio/${mediaPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
