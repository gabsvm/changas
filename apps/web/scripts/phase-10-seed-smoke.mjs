import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
if (!supabaseUrl || !anonKey) {
  throw new Error("API_URL and ANON_KEY are required for Phase 10 seed smoke checks.");
}

const client = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const discovery = await client.rpc("search_discovery_services_v3", {
  query_text: "reparacion pc",
  page_number: 1,
  page_size: 24,
});
if (
  discovery.error ||
  !discovery.data?.some(
    (row) =>
      row.provider_slug === "demo-proveedor" &&
      row.service_slug === "demo-revision-pc",
  )
) {
  throw new Error(
    `Demo seed is not reproducible through public discovery: ${discovery.error?.message ?? "missing demo result"}`,
  );
}

console.log("Phase 10 synthetic seed/demo smoke checks: PASS");
