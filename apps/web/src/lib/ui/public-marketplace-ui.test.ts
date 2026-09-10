import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const providerPage = source("../../app/p/[slug]/page.tsx");
const servicePage = source("../../app/p/[slug]/[serviceSlug]/page.tsx");
const brandHero = source("../../components/ui/marketplace/brand-hero.tsx");
const categoryTile = source(
  "../../components/ui/marketplace/category-tile.tsx",
);
const nearbyServiceRail = source(
  "../../components/ui/marketplace/nearby-service-rail.tsx",
);

describe("public marketplace detail UI", () => {
  it("avoids giant hero-card chrome", () => {
    for (const file of [providerPage, servicePage]) {
      expect(file).not.toContain("rounded-[2rem]");
      expect(file).not.toContain("text-5xl");
      expect(file).not.toContain("shadow-[0_24px_80px");
    }
  });

  it("humanizes service modality instead of rendering the raw enum", () => {
    expect(providerPage).toContain("getServiceModalityLabel");
    expect(servicePage).toContain("getServiceModalityLabel");
    expect(providerPage).not.toContain("{service.modality}");
    expect(servicePage).not.toContain("{service.modality}");
  });

  it("keeps real public actions and reputation", () => {
    expect(providerPage).toContain("toggleProviderFavorite");
    expect(providerPage).toContain("ProviderReputation");
    expect(servicePage).toContain("startServiceConversation");
  });

  it("keeps marketplace compositions semantic and public-data only", () => {
    expect(brandHero).toContain("<section");
    expect(brandHero).toContain("<h1");
    expect(categoryTile).toContain("Link");
    expect(categoryTile).toContain("min-h-12");
    expect(nearbyServiceRail).toContain("ServiceCard");
    expect(nearbyServiceRail).toContain("aria-label");
    for (const file of [brandHero, categoryTile, nearbyServiceRail]) {
      expect(file).not.toContain("rating");
      expect(file).not.toContain("verific");
    }
  });
});
