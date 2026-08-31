import { describe, expect, it } from "vitest";

import { getManualLocation, manualLocations } from "./location";

describe("manual discovery locations", () => {
  it("contains coarse Argentina-oriented options without exposing service areas", () => {
    expect(
      manualLocations.some((location) => location.slug === "palermo"),
    ).toBe(true);
    expect(manualLocations[0]).not.toHaveProperty("center");
    expect(manualLocations[0]).toHaveProperty("latitude");
    expect(manualLocations[0]).toHaveProperty("longitude");
  });

  it("rejects unknown manual locations", () => {
    expect(getManualLocation("not-a-zone")).toBeNull();
    expect(getManualLocation("palermo")?.label).toBe("Palermo");
  });
});
