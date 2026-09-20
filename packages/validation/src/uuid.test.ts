import { describe, expect, it } from "vitest";

import { isUuid } from "./index";

describe("isUuid", () => {
  it("preserves the accepted RFC 4122 UUID contract", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    expect(isUuid("550e8400-e29b-91d4-a716-446655440000")).toBe(false);
    expect(isUuid("550e8400-e29b-41d4-c716-446655440000")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
