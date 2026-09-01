import { describe, expect, it } from "vitest";

import { createFakeAdditionalPaymentRecord } from "./server";

describe("job payment adapter", () => {
  it("routes fake scope-change charges through PaymentProvider", async () => {
    const payment = await createFakeAdditionalPaymentRecord({
      paymentNonce: "06620000-0000-4000-8000-000000000001",
      amountMinor: 50000,
      currencyCode: "ARS",
      outcome: "PENDING",
    });

    expect(payment).toMatchObject({
      idempotencyKey: "06620000-0000-4000-8000-000000000001",
      amountMinor: 50000,
      currencyCode: "ARS",
      status: "PENDING",
    });
    expect(payment.id).toMatch(/^fakepay_[0-9a-f]{8}$/);
  });
});
