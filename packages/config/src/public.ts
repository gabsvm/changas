import {
  publicSupabaseEnvSchema,
  publicSiteUrlSchema,
  type PublicSupabaseEnv,
} from "@changas/validation";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return publicSupabaseEnvSchema.parse({
    url: requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  });
}

export function getPublicSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const parsed = publicSiteUrlSchema.parse(value);

  return parsed.replace(/\/$/, "");
}
