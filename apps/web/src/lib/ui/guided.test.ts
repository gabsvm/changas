import { describe, expect, it } from "vitest";

import { guideProgress } from "./guided";

describe("guided flows", () => {
  it("clamps progress to the current step", () => {
    expect(guideProgress(1, 4)).toBe(25);
    expect(guideProgress(99, 4)).toBe(100);
    expect(guideProgress(0, 4)).toBe(25);
    expect(guideProgress(2, 0)).toBe(0);
  });
});
