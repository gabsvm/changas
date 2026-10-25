import { describe, expect, it } from "vitest";

import { getServiceHireKind, isInstantBookingEligible } from "./direct-booking";

describe("getServiceHireKind", () => {
  it("reserves instantly bookable fixed services directly", () => {
    expect(
      getServiceHireKind({
        price_model: "FIXED",
        price_amount: 100000,
        instant_booking_enabled: true,
      }),
    ).toBe("DIRECT_BOOKING");
  });

  it("never issues DIRECT_BOOKING when fixed but not preauthorized", () => {
    expect(
      getServiceHireKind({
        price_model: "FIXED",
        price_amount: 100000,
        instant_booking_enabled: false,
      }),
    ).toBe("QUOTE_REQUEST");
  });

  it("asks for a quote when the price is not fixed", () => {
    for (const service of [
      {
        price_model: "HOURLY",
        price_amount: 5000,
        instant_booking_enabled: true,
      },
      {
        price_model: "QUOTE",
        price_amount: null,
        instant_booking_enabled: false,
      },
      {
        price_model: "FIXED",
        price_amount: null,
        instant_booking_enabled: true,
      },
    ]) {
      expect(getServiceHireKind(service)).toBe("QUOTE_REQUEST");
    }
  });
});

describe("isInstantBookingEligible", () => {
  it("requires fixed price, amount and the provider flag", () => {
    expect(
      isInstantBookingEligible({
        price_model: "FIXED",
        price_amount: 100000,
        instant_booking_enabled: true,
      }),
    ).toBe(true);
    expect(
      isInstantBookingEligible({
        price_model: "FIXED",
        price_amount: 100000,
        instant_booking_enabled: false,
      }),
    ).toBe(false);
    expect(
      isInstantBookingEligible({
        price_model: "HOURLY",
        price_amount: 5000,
        instant_booking_enabled: true,
      }),
    ).toBe(false);
  });
});
