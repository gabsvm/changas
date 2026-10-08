import { NextResponse } from "next/server";

import { buildMercadoPagoOAuthRedirect } from "@/lib/payments/server";
import {
  getClientIp,
  oauthStartRateLimiter,
  rateLimitKey,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const decision = oauthStartRateLimiter.check(
    rateLimitKey(getClientIp(request.headers), "oauth-start"),
  );
  if (!decision.allowed) {
    return rateLimitedResponse(decision.retryAfterSeconds);
  }

  try {
    const authorizationUrl = await buildMercadoPagoOAuthRedirect();
    return noStore(NextResponse.redirect(authorizationUrl, 302));
  } catch {
    const fallback = new URL("/provider/manage", request.url);
    fallback.searchParams.set("payment_account", "oauth_error");
    return noStore(NextResponse.redirect(fallback, 303));
  }
}
