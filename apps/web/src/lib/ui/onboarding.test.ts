import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { getOnboardingSteps } from "./onboarding";

const accountPage = readFileSync(
  new URL("../../app/(account)/account/page.tsx", import.meta.url),
  "utf8",
);
const onboardingPage = readFileSync(
  new URL("../../app/(provider)/provider/onboarding/page.tsx", import.meta.url),
  "utf8",
);

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

  it("keeps onboarding as the single verification home", () => {
    expect(accountPage).toContain("Ver mi verificación");
    expect(accountPage).not.toContain("Continuar verificación");
    expect(accountPage).not.toContain("ProgressBar");
    expect(onboardingPage).toContain("OnboardingStepCard");
    expect(onboardingPage).toContain("getNextOnboardingHref");
    expect(onboardingPage).toContain("Progreso");
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
