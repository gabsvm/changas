import { describe, expect, it } from "vitest";

import { getOnboardingSteps } from "./onboarding";

describe("getOnboardingSteps", () => {
  it("defines the four stable onboarding steps", () => {
    expect(getOnboardingSteps(1).map((step) => step.id)).toEqual([
      "profile",
      "identity",
      "documents",
      "review",
    ]);
  });

  it("marks previous, current and future steps deterministically", () => {
    expect(getOnboardingSteps(2).map((step) => step.state)).toEqual([
      "complete",
      "current",
      "pending",
      "pending",
    ]);
  });

  it("clamps an out-of-range current step safely", () => {
    expect(getOnboardingSteps(99).map((step) => step.state)).toEqual([
      "complete",
      "complete",
      "complete",
      "current",
    ]);
  });
});
