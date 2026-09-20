import { NextResponse } from "next/server";

import { completeMercadoPagoOAuthCallback } from "@/lib/payments/server";
import { safeNextPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithNoStore(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function fallbackUrl(request: Request) {
  const url = new URL("/provider/manage", request.url);
  url.searchParams.set("payment_account", "oauth_error");
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (!code || !state) {
    return redirectWithNoStore(fallbackUrl(request));
  }

  try {
    const result = await completeMercadoPagoOAuthCallback({ code, state });
    const destination = new URL(
      safeNextPath(result.returnPath, "/provider/manage"),
      request.url,
    );
    destination.searchParams.set("payment_account", "connected");
    return redirectWithNoStore(destination);
  } catch {
    return redirectWithNoStore(fallbackUrl(request));
  }
}
