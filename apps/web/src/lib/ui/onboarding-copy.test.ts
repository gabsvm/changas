import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const customerFacingOnboarding = [
  "../../app/(provider)/provider/onboarding/documents/page.tsx",
  "../../app/(provider)/provider/onboarding/review/page.tsx",
]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n");

describe("provider onboarding copy", () => {
  it.each([
    "server action",
    "código cliente arbitrario",
    "Storage",
    "lógica existente",
    "estado real",
  ])("does not expose engineering language: %s", (phrase) => {
    expect(customerFacingOnboarding).not.toContain(phrase);
  });

  it("explains privacy and review in user language", () => {
    expect(customerFacingOnboarding).toContain("Tus documentos son privados");
    expect(customerFacingOnboarding).toContain("revisión");
  });
});
