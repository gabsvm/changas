import { describe, expect, it } from "vitest";

import { getHealthPayload } from "./health";

describe("getHealthPayload", () => {
  it("returns the stable service health shape with the supplied timestamp", () => {
    expect(getHealthPayload("2026-08-29T00:00:00.000Z")).toEqual({
      status: "ok",
      service: "changas-web",
      timestamp: "2026-08-29T00:00:00.000Z",
    });
  });
});
