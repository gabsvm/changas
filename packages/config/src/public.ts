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

export function getPublicSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const parsed = publicSiteUrlSchema.parse(value);

  return parsed.replace(/\/$/, "");
}
