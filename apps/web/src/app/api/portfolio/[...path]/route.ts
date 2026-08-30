import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path.length || path.length > 3)
    return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("provider-portfolio")
    .download(path.join("/"));
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": data.type || "application/octet-stream",
    },
  });
}
