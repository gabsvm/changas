import { NextResponse } from "next/server";

import { dispatchNotificationBatch } from "@/lib/notifications/dispatcher";
import { isAuthorizedDispatchRequest } from "@/lib/notifications/delivery";
import {
  dispatchRateLimiter,
  getClientIp,
  isAllowedRequestOrigin,
  rateLimitKey,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  if (
    !isAuthorizedDispatchRequest(
      request.headers.get("authorization"),
      process.env.NOTIFICATION_DISPATCH_SECRET,
    )
  ) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const decision = dispatchRateLimiter.check(
    rateLimitKey(getClientIp(request.headers), "dispatch"),
  );
  if (!decision.allowed) {
    return rateLimitedResponse(decision.retryAfterSeconds);
  }

  try {
    const summary = await dispatchNotificationBatch();
    return jsonResponse({ ok: true, ...summary }, 200);
  } catch {
    return jsonResponse({ error: "delivery_dispatch_failed" }, 500);
  }
}
