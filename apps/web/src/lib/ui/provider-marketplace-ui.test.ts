import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const onboardingPage = source(
  "../../app/(provider)/provider/onboarding/page.tsx",
);
const onboardingProfilePage = source(
  "../../app/(provider)/provider/onboarding/profile/page.tsx",
);
const onboardingIdentityPage = source(
  "../../app/(provider)/provider/onboarding/identity/page.tsx",
);
const onboardingDocumentsPage = source(
  "../../app/(provider)/provider/onboarding/documents/page.tsx",
);
const onboardingReviewPage = source(
  "../../app/(provider)/provider/onboarding/review/page.tsx",
);
const managePage = source("../../app/(provider)/provider/manage/page.tsx");
const stepComponent = source(
  "../../components/provider/onboarding-step-card.tsx",
);

describe("provider marketplace app-first UI", () => {
  it("keeps onboarding compact instead of stacking large cards", () => {
    for (const file of [
      onboardingPage,
      onboardingProfilePage,
      onboardingIdentityPage,
      onboardingDocumentsPage,
      onboardingReviewPage,
      stepComponent,
    ]) {
      expect(file).not.toContain("rounded-3xl");
    }
  });

  it("uses humanized provider status in management", () => {
    expect(managePage).toContain("getProviderStatusPresentation");
    expect(managePage).not.toContain("{provider.status}");
  });

  it("does not regress the provider profile step to a URL-based avatar field", () => {
    expect(onboardingProfilePage).not.toContain("avatarUrl:");
    expect(onboardingProfilePage).toContain("ProfileAvatarUploader");
  });
});
