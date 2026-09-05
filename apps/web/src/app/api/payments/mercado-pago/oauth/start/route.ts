import { NextResponse } from "next/server";

import { buildMercadoPagoOAuthRedirect } from "@/lib/payments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  try {
    const authorizationUrl = await buildMercadoPagoOAuthRedirect();
    return noStore(NextResponse.redirect(authorizationUrl, 302));
  } catch {
    const fallback = new URL("/provider/manage", request.url);
    fallback.searchParams.set("payment_account", "oauth_error");
    return noStore(NextResponse.redirect(fallback, 303));
  }
}
