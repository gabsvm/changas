import type { CurrencyCode } from "./money";

export const paymentStatuses = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];
export type FakePaymentOutcome = "SUCCESS" | "PENDING" | "FAILURE";

export type PaymentRequest = {
  idempotencyKey: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  outcome?: FakePaymentOutcome;
};

export type PaymentRecord = {
  id: string;
  idempotencyKey: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  status: PaymentStatus;
};

export interface PaymentProvider {
  createPayment(input: PaymentRequest): Promise<PaymentRecord>;
  getPaymentStatus(paymentId: string): Promise<PaymentRecord>;
  refund(paymentId: string, amountMinor?: number): Promise<PaymentRecord>;
  createAdditionalCharge(input: PaymentRequest): Promise<PaymentRecord>;
}

function stableFakeId(prefix: string, key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export class FakePaymentProvider implements PaymentProvider {
  private readonly records = new Map<string, PaymentRecord>();
  private readonly ids = new Map<string, string>();

  async createPayment(input: PaymentRequest): Promise<PaymentRecord> {
    const existingId = this.ids.get(input.idempotencyKey);
    if (existingId) return this.getPaymentStatus(existingId);

    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("Payment amount must be a positive safe integer.");
    }

    const id = stableFakeId("fakepay", input.idempotencyKey);
    const status: PaymentStatus =
      input.outcome === "PENDING"
        ? "PENDING"
        : input.outcome === "FAILURE"
          ? "FAILED"
          : "SUCCEEDED";
    const record: PaymentRecord = {
      id,
      idempotencyKey: input.idempotencyKey,
      amountMinor: input.amountMinor,
      currencyCode: input.currencyCode,
      status,
    };

    this.records.set(id, record);
    this.ids.set(input.idempotencyKey, id);
    return record;
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentRecord> {
    const record = this.records.get(paymentId);
    if (!record) throw new Error("Payment not found.");
    return { ...record };
  }

  async refund(paymentId: string, amountMinor?: number): Promise<PaymentRecord> {
    const payment = await this.getPaymentStatus(paymentId);
    if (payment.status !== "SUCCEEDED") {
      throw new Error("Only succeeded payments can be refunded.");
    }

    const refundAmount = amountMinor ?? payment.amountMinor;
    if (
      !Number.isSafeInteger(refundAmount) ||
      refundAmount <= 0 ||
      refundAmount > payment.amountMinor
    ) {
      throw new Error("Refund amount is invalid.");
    }

    const refunded: PaymentRecord = {
      ...payment,
      id: stableFakeId("fakerefund", `${payment.id}:${refundAmount}`),
      amountMinor: refundAmount,
      status: "REFUNDED",
    };
    this.records.set(refunded.id, refunded);
    return refunded;
  }

  createAdditionalCharge(input: PaymentRequest): Promise<PaymentRecord> {
    return this.createPayment(input);
  }
}
