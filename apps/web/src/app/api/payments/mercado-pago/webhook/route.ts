import { NextResponse } from "next/server";

import {
  PaymentWebhookError,
  processMercadoPagoWebhook,
} from "@/lib/payments/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const rawBody = await request.text();

  try {
    const result = await processMercadoPagoWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: url.searchParams.get("data.id"),
      rawBody,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentWebhookError) {
      if (error.code === "INVALID_WEBHOOK_SIGNATURE") {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
      if (error.code === "INVALID_WEBHOOK_EVENT") {
        return NextResponse.json({ ok: false }, { status: 400 });
      }
      if (error.code === "RECONCILIATION_MISMATCH") {
        return NextResponse.json(
          { ok: true, processed: false, durableFailure: true },
          { status: 200 },
        );
      }
      if (
        error.code === "SELLER_NOT_CONNECTED" ||
        error.code === "PROVIDER_UNAVAILABLE" ||
        error.code === "PERSISTENCE_ERROR"
      ) {
        return NextResponse.json({ ok: false }, { status: 503 });
      }
    }

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
