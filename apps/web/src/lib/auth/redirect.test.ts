import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("accepts relative application paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/provider/onboarding?step=2")).toBe(
      "/provider/onboarding?step=2",
    );
    expect(safeNextPath("/")).toBe("/");
  });

  it("rejects external URLs and schemes", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath("javascript:alert(1)")).toBe("/account");
  });
});
