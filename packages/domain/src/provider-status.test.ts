import { describe, expect, it } from "vitest";

import { canSelfManageProviderStatus } from "./provider-status";

describe("canSelfManageProviderStatus", () => {
  it("allows the two onboarding states", () => {
    expect(canSelfManageProviderStatus("PROFILE_INCOMPLETE")).toBe(true);
    expect(canSelfManageProviderStatus("IDENTITY_PENDING")).toBe(true);
  });

  it("does not allow protected or terminal states", () => {
    expect(canSelfManageProviderStatus("ACTIVE")).toBe(false);
    expect(canSelfManageProviderStatus("UNDER_REVIEW")).toBe(false);
    expect(canSelfManageProviderStatus("SUSPENDED")).toBe(false);
    expect(canSelfManageProviderStatus("DEACTIVATED")).toBe(false);
  });
});
