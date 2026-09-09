import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.length !== 2) return new Response("Not found", { status: 404 });

  const objectPath = path.join("/");
  const avatarUrl = `/api/avatar/${objectPath}`;
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("avatar_url", avatarUrl)
    .maybeSingle();

  if (profileError || !profile?.avatar_url) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("profile-avatars")
    .download(objectPath);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": data.type || "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
