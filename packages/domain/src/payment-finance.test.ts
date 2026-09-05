import { describe, expect, it } from "vitest";

import type { PaymentStatus } from "./payments";
import {
  assertValidRefundAmount,
  calculateMarketplaceFeeMinor,
  calculateProviderExpectedNetMinor,
  canTransitionPaymentStatus,
} from "./payment-finance";

describe("Phase 11 financial rules", () => {
  it("calculates marketplace commission with deterministic integer floor rounding", () => {
    expect(calculateMarketplaceFeeMinor(100_00, 1_000)).toBe(10_00);
    expect(calculateMarketplaceFeeMinor(99, 333)).toBe(3);
    expect(calculateMarketplaceFeeMinor(1, 1)).toBe(0);
  });

  it("rejects invalid fee inputs and unsafe monetary values", () => {
    expect(() => calculateMarketplaceFeeMinor(0, 1_000)).toThrow();
    expect(() => calculateMarketplaceFeeMinor(-1, 1_000)).toThrow();
    expect(() =>
      calculateMarketplaceFeeMinor(Number.MAX_SAFE_INTEGER + 1, 1_000),
    ).toThrow();
    expect(() => calculateMarketplaceFeeMinor(10_000, -1)).toThrow();
    expect(() => calculateMarketplaceFeeMinor(10_000, 10_001)).toThrow();
    expect(() => calculateMarketplaceFeeMinor(10_000, 100.5)).toThrow();
  });

  it("derives expected provider net from exact minor units", () => {
    expect(calculateProviderExpectedNetMinor(100_00, 10_00)).toBe(90_00);
    expect(() => calculateProviderExpectedNetMinor(100_00, 100_01)).toThrow();
    expect(() => calculateProviderExpectedNetMinor(0, 0)).toThrow();
  });

  it("validates cumulative refund amounts without allowing over-refund", () => {
    expect(() => assertValidRefundAmount(100_00, 0, 25_00)).not.toThrow();
    expect(() => assertValidRefundAmount(100_00, 25_00, 75_00)).not.toThrow();
    expect(() => assertValidRefundAmount(100_00, 25_00, 75_01)).toThrow();
    expect(() => assertValidRefundAmount(100_00, 100_00, 1)).toThrow();
    expect(() => assertValidRefundAmount(100_00, 0, 0)).toThrow();
  });

  it.each<[PaymentStatus, PaymentStatus, boolean]>([
    ["PENDING", "PENDING", true],
    ["PENDING", "SUCCEEDED", true],
    ["PENDING", "FAILED", true],
    ["SUCCEEDED", "SUCCEEDED", true],
    ["FAILED", "FAILED", true],
    ["REFUNDED", "REFUNDED", true],
    ["SUCCEEDED", "FAILED", false],
    ["FAILED", "SUCCEEDED", false],
    ["SUCCEEDED", "PENDING", false],
    ["FAILED", "PENDING", false],
    ["REFUNDED", "SUCCEEDED", false],
  ])(
    "allows only monotonic payment transition %s -> %s = %s",
    (from, to, expected) => {
      expect(canTransitionPaymentStatus(from, to)).toBe(expected);
    },
  );
});
