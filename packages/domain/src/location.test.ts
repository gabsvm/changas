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

  it("keeps the five AMBA zones and adds three documented Córdoba zones", () => {
    const slugs = manualLocations.map((location) => location.slug);
    for (const slug of [
      "palermo",
      "belgrano",
      "caballito",
      "san-telmo",
      "vicente-lopez",
    ]) {
      expect(slugs).toContain(slug);
    }
    expect(getManualLocation("cordoba-capital")?.label).toBe("Córdoba Capital");
    expect(getManualLocation("villa-carlos-paz")?.label).toBe(
      "Villa Carlos Paz",
    );
    expect(getManualLocation("rio-cuarto")?.label).toBe("Río Cuarto");
  });

  it("rejects unknown manual locations", () => {
    expect(getManualLocation("not-a-zone")).toBeNull();
    expect(getManualLocation("palermo")?.label).toBe("Palermo");
  });
});
