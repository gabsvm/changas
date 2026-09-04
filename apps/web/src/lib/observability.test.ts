import { describe, expect, it } from "vitest";

import { buildClientErrorEvent } from "./observability";

describe("buildClientErrorEvent", () => {
  it("keeps diagnostics useful without serializing the error message", () => {
    const error = Object.assign(new Error("private@example.test"), {
      digest: "abc123",
    });

    expect(buildClientErrorEvent("route", error, "2026-09-04T00:00:00.000Z")).toEqual({
      level: "error",
      event: "ui_error",
      scope: "route",
      timestamp: "2026-09-04T00:00:00.000Z",
      error_name: "Error",
      digest: "abc123",
    });
    expect(JSON.stringify(buildClientErrorEvent("route", error))).not.toContain(
      "private@example.test",
    );
  });
});
