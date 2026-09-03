import { NextResponse } from "next/server";

import {
  AdminIdentityError,
  createAdminIdentityDocumentSignedUrl,
} from "@/lib/admin/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;

  try {
    const document = await createAdminIdentityDocumentSignedUrl(documentId);
    const response = NextResponse.redirect(document.url, 302);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  } catch (error) {
    if (error instanceof AdminIdentityError) {
      if (error.code === "UNAUTHORIZED") return jsonError("unauthorized", 401);
      if (error.code === "FORBIDDEN") return jsonError("forbidden", 403);
      if (error.code === "NOT_FOUND" || error.code === "CONFLICT") {
        return jsonError("not_found", 404);
      }
    }

    return jsonError("unavailable", 503);
  }
}
