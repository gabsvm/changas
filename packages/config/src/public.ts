import {
  publicSupabaseEnvSchema,
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
