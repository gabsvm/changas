import { describe, expect, it } from "vitest";

import { requiresPasswordConfirmation } from "./account-deletion";

describe("requiresPasswordConfirmation", () => {
  it("requires a password for email-only accounts", () => {
    expect(
      requiresPasswordConfirmation({
        identities: [{ provider: "email" }],
        app_metadata: { provider: "email", providers: ["email"] },
      }),
    ).toBe(true);
  });

  it("does not require a password for OAuth-only accounts", () => {
    expect(
      requiresPasswordConfirmation({
        identities: [{ provider: "google" }],
        app_metadata: { provider: "google", providers: ["google"] },
      }),
    ).toBe(false);
  });

  it("requires a password when an email identity is linked next to OAuth", () => {
    expect(
      requiresPasswordConfirmation({
        identities: [{ provider: "google" }, { provider: "email" }],
        app_metadata: { provider: "google", providers: ["google", "email"] },
      }),
    ).toBe(true);
  });

  it("falls back to app_metadata when there are no identities", () => {
    expect(
      requiresPasswordConfirmation({
        identities: [],
        app_metadata: { provider: "email" },
      }),
    ).toBe(true);
    expect(
      requiresPasswordConfirmation({
        app_metadata: { providers: ["google", "email"] },
      }),
    ).toBe(true);
    expect(
      requiresPasswordConfirmation({
        identities: undefined,
        app_metadata: { provider: "google" },
      }),
    ).toBe(false);
  });

  it("does not require a password for a missing user", () => {
    expect(requiresPasswordConfirmation(null)).toBe(false);
    expect(requiresPasswordConfirmation(undefined)).toBe(false);
  });
});
