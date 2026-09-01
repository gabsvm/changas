import { describe, expect, it } from "vitest";

import { FakePaymentProvider } from "./payments";

describe("FakePaymentProvider", () => {
  it("returns deterministic success, pending and failure records", async () => {
    const provider = new FakePaymentProvider();

    await expect(
      provider.createPayment({
        idempotencyKey: "proposal:v1:success",
        amountMinor: 1250000,
        currencyCode: "ARS",
        outcome: "SUCCESS",
      }),
    ).resolves.toMatchObject({ status: "SUCCEEDED" });

    await expect(
      provider.createPayment({
        idempotencyKey: "proposal:v1:pending",
        amountMinor: 1250000,
        currencyCode: "ARS",
        outcome: "PENDING",
      }),
    ).resolves.toMatchObject({ status: "PENDING" });

    await expect(
      provider.createPayment({
        idempotencyKey: "proposal:v1:failure",
        amountMinor: 1250000,
        currencyCode: "ARS",
        outcome: "FAILURE",
      }),
    ).resolves.toMatchObject({ status: "FAILED" });
  });

  it("is idempotent for the same key", async () => {
    const provider = new FakePaymentProvider();
    const input = {
      idempotencyKey: "proposal:v2",
      amountMinor: 2500000,
      currencyCode: "ARS" as const,
      outcome: "SUCCESS" as const,
    };

    const first = await provider.createPayment(input);
    const second = await provider.createPayment(input);

    expect(second).toEqual(first);
  });

  it("simulates refunds and additional charges without provider-specific domain states", async () => {
    const provider = new FakePaymentProvider();
    const payment = await provider.createPayment({
      idempotencyKey: "proposal:v3",
      amountMinor: 1000000,
      currencyCode: "ARS",
      outcome: "SUCCESS",
    });

    await expect(provider.refund(payment.id, 500000)).resolves.toMatchObject({
      status: "REFUNDED",
      amountMinor: 500000,
    });
    await expect(
      provider.createAdditionalCharge({
        idempotencyKey: "job:extra:1",
        amountMinor: 200000,
        currencyCode: "ARS",
        outcome: "SUCCESS",
      }),
    ).resolves.toMatchObject({ status: "SUCCEEDED", amountMinor: 200000 });
  });
});
