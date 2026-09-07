import { getHealthPayload } from "@/lib/health";

export const dynamic = "force-dynamic";

function getSupabaseProjectRef() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return null;

  try {
    const hostname = new URL(value).hostname;
    return hostname.endsWith(".supabase.co")
      ? hostname.slice(0, -".supabase.co".length)
      : null;
  } catch {
    return null;
  }
}

export function GET() {
  return Response.json(
    {
      ...getHealthPayload(),
      supabaseProjectRef: getSupabaseProjectRef(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
