import { describe, expect, it } from "vitest";

import { isTrustedPublicAvatarUrl } from "./public-media";

describe("public avatar URL policy", () => {
  it("rejects provider-controlled external images", () => {
    expect(isTrustedPublicAvatarUrl("https://tracker.example/avatar.jpg")).toBe(
      false,
    );
    expect(isTrustedPublicAvatarUrl("https://example.com/api/avatar/a")).toBe(
      false,
    );
  });

  it("accepts only first-party avatar paths", () => {
    expect(isTrustedPublicAvatarUrl("http://localhost:3000/api/avatar/a")).toBe(
      true,
    );
    expect(isTrustedPublicAvatarUrl("http://localhost:3000/other/a")).toBe(
      false,
    );
  });
});
