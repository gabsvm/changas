import { z } from "zod";

export const publicSupabaseEnvSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;
