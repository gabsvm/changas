import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@changas/config/public";

import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey } = getPublicSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, publishableKey);

  return browserClient;
}
