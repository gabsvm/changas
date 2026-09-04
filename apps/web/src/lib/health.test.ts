import { describe, expect, it } from "vitest";

import { getHealthPayload } from "./health";

describe("getHealthPayload", () => {
  it("returns a safe liveness shape with bounded deployment metadata", () => {
    expect(
      getHealthPayload("2026-09-04T00:00:00.000Z", {
        revision: "1234567890abcdef",
        environment: "preview",
      }),
    ).toEqual({
      status: "ok",
      service: "changas-web",
      mode: "liveness",
      timestamp: "2026-09-04T00:00:00.000Z",
      revision: "1234567890ab",
      environment: "preview",
    });
  });

  it("does not echo arbitrary environment values", () => {
    expect(
      getHealthPayload("2026-09-04T00:00:00.000Z", {
        revision: undefined,
        environment: "secret-environment-name",
      }).environment,
    ).toBe("unknown");
  });
});
