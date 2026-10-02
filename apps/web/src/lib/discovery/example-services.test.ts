import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EXAMPLE_SERVICES } from "./example-services";

describe("example services", () => {
  it("are clearly fictional and never point at real providers", () => {
    expect(EXAMPLE_SERVICES.length).toBeGreaterThan(0);
    for (const row of EXAMPLE_SERVICES) {
      expect(row.provider_slug.startsWith("ejemplo-")).toBe(true);
      expect(row.service_slug.startsWith("ejemplo-")).toBe(true);
      expect(row.provider_avatar_url).toBeNull();
    }
  });

  it("render as a labelled, non-link card", () => {
    const card = readFileSync(
      new URL(
        "../../components/ui/marketplace/service-card.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(card).toContain("example");
    expect(card).toContain("Ejemplo");
    expect(card).toContain("Ejemplo ficticio");
  });
});
