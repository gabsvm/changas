import type { CurrencyCode, PaymentRecord } from "@changas/domain";
import { FakePaymentProvider, supportedCurrencyCodes } from "@changas/domain";

export type FakeAdditionalPaymentOutcome = "SUCCESS" | "PENDING" | "FAILURE";

export type FakeAdditionalPaymentRecordInput = {
  paymentNonce: string;
  amountMinor: number;
  currencyCode: string;
  outcome: FakeAdditionalPaymentOutcome;
};

export async function createFakeAdditionalPaymentRecord(
  input: FakeAdditionalPaymentRecordInput,
): Promise<PaymentRecord> {
  if (!supportedCurrencyCodes.includes(input.currencyCode as CurrencyCode)) {
    throw new Error("Unsupported additional-payment currency.");
  }

  const provider = new FakePaymentProvider();
  return provider.createAdditionalCharge({
    idempotencyKey: input.paymentNonce,
    amountMinor: input.amountMinor,
    currencyCode: input.currencyCode as CurrencyCode,
    outcome: input.outcome,
  });
}
