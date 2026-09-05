import { NextResponse } from "next/server";

import { completeMercadoPagoOAuthCallback } from "@/lib/payments/server";

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

function safeLocalReturnUrl(request: Request, returnPath: string) {
  if (
    !returnPath.startsWith("/") ||
    returnPath.startsWith("//") ||
    returnPath.includes("\\")
  ) {
    return fallbackUrl(request);
  }
  return new URL(returnPath, request.url);
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
    const destination = safeLocalReturnUrl(request, result.returnPath);
    destination.searchParams.set("payment_account", "connected");
    return redirectWithNoStore(destination);
  } catch {
    return redirectWithNoStore(fallbackUrl(request));
  }
}
