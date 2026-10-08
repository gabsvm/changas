import {
  publicSupabaseEnvSchema,
  publicSiteUrlSchema,
  type PublicSupabaseEnv,
} from "@changas/validation";

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return publicSupabaseEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

const LOOPBACK_HOSTS: Record<string, true> = {
  localhost: true,
  "127.0.0.1": true,
  "[::1]": true,
};

/**
 * Allowlist de hosts para NEXT_PUBLIC_SITE_URL: local, previews de Vercel
 * (*.vercel.app) y hosts extra declarados en NEXT_PUBLIC_SITE_ALLOWED_HOSTS
 * (coma-separados, ej: el dominio prod). Cualquier otro host falla rápido
 * en startup para no firmar callbacks ni links contra un origen trucho.
 */
export function getPublicSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const parsed = publicSiteUrlSchema.parse(value);
  const normalized = parsed.replace(/\/$/, "");

  const hostname = new URL(normalized).hostname.toLowerCase();
  const extraHosts = (process.env.NEXT_PUBLIC_SITE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  const extraAllowed: Record<string, true> = {};
  for (const host of extraHosts) extraAllowed[host] = true;

  const allowed =
    LOOPBACK_HOSTS[hostname] === true ||
    hostname.endsWith(".vercel.app") ||
    extraAllowed[hostname] === true;

  if (!allowed) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL host "${hostname}" is not allowlisted. ` +
        `Use localhost, a *.vercel.app preview, or declare the production ` +
        `domain in NEXT_PUBLIC_SITE_ALLOWED_HOSTS.`,
    );
  }

  return normalized;
}
