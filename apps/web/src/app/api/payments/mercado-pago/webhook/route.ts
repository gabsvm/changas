import { NextResponse } from "next/server";

import {
  getClientIp,
  isAllowedRequestOrigin,
  rateLimitKey,
  rateLimitedResponse,
  webhookRateLimiter,
} from "@/lib/rate-limit";
import {
  PaymentWebhookError,
  processMercadoPagoWebhook,
} from "@/lib/payments/webhook";

export const runtime = "nodejs";

function genericOk(processed: boolean) {
  return NextResponse.json(
    { ok: true, processed },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const identity =
    new URL(request.url).searchParams.get("data.id")?.trim() || "webhook";
  const decision = webhookRateLimiter.check(
    rateLimitKey(getClientIp(request.headers), identity),
  );
  if (!decision.allowed) {
    return rateLimitedResponse(decision.retryAfterSeconds);
  }

  const url = new URL(request.url);
  const rawBody = await request.text();

  try {
    const result = await processMercadoPagoWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: url.searchParams.get("data.id"),
      rawBody,
    });

    return genericOk(result.processed);
  } catch (error) {
    if (error instanceof PaymentWebhookError) {
      // Sin oráculo: el detalle va solo al log server-side. Para MP todo
      // lo no-reintentable responde 200 genérico para no filtrar si la
      // firma, el evento o la conciliación fallaron.
      console.error("Mercado Pago webhook rejected", {
        code: error.code,
        message: error.message,
      });
      if (
        error.code === "PROVIDER_UNAVAILABLE" ||
        error.code === "PERSISTENCE_ERROR"
      ) {
        return NextResponse.json({ ok: false }, { status: 503 });
      }
      return genericOk(false);
    }

    console.error("Mercado Pago webhook failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
