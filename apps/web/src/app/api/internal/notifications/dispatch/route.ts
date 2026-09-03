import { NextResponse } from "next/server";

import { dispatchNotificationBatch } from "@/lib/notifications/dispatcher";
import { isAuthorizedDispatchRequest } from "@/lib/notifications/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (
    !isAuthorizedDispatchRequest(
      request.headers.get("authorization"),
      process.env.NOTIFICATION_DISPATCH_SECRET,
    )
  ) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  try {
    const summary = await dispatchNotificationBatch();
    return jsonResponse({ ok: true, ...summary }, 200);
  } catch {
    return jsonResponse({ error: "delivery_dispatch_failed" }, 500);
  }
}
