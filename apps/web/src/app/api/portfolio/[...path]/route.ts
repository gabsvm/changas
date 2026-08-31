import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path.length || path.length > 3)
    return new Response("Not found", { status: 404 });
  const objectPath = path.join("/");
  const supabase = await createClient();
  const { data: publicItem, error: projectionError } = await supabase
    .from("public_provider_portfolio")
    .select("media_path, media_mime_type")
    .eq("media_path", objectPath)
    .maybeSingle();

  if (projectionError || !publicItem?.media_path) {
    return new Response("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("provider-portfolio")
    .download(objectPath);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type":
        publicItem.media_mime_type || data.type || "application/octet-stream",
    },
  });
}
