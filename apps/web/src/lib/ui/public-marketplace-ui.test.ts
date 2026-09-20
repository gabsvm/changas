import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const providerPage = source("../../app/p/[slug]/page.tsx");
const servicePage = source("../../app/p/[slug]/[serviceSlug]/page.tsx");
const searchPage = source("../../app/buscar/page.tsx");
const categoryPage = source("../../app/categoria/[slug]/page.tsx");
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

  it("makes search filters removable without losing the query", () => {
    expect(searchPage).toContain("discovery-hero");
    expect(searchPage).toContain("discovery-results-shell");
    expect(searchPage).toContain("Filtros activos");
    expect(searchPage).toContain("Quitar filtro");
    expect(searchPage).toContain("clearHref");
  });

  it("keeps fixed CTA bars clear of the system gesture area", () => {
    expect(servicePage).toContain("service-cta-bar");
    expect(servicePage).toContain("safe-area-inset-bottom");
    expect(providerPage).toContain("service-cta-bar");
    expect(providerPage).toContain("safe-area-inset-bottom");
  });

  it("lets category visitors refine without leaving", () => {
    expect(categoryPage).toContain("discovery-hero");
    expect(categoryPage).toContain("discovery-results-shell");
    expect(categoryPage).toContain('name="q"');
    expect(categoryPage).toContain('"presencial"');
    expect(categoryPage).toContain('"remoto"');
    expect(categoryPage).toContain("categoryHref");
    expect(categoryPage).toContain("rounded-[1.25rem]");
    expect(categoryPage).not.toContain("rounded-[1.75rem]");
    expect(categoryPage).toContain("pageHref");
  });

  it("offers contact next to save on wide provider profiles", () => {
    expect(providerPage).toContain("Guardar proveedor");
    expect(providerPage).toContain("Contactar");
    expect(providerPage).toContain("hidden gap-3 sm:flex");
  });

  it("keeps marketplace compositions semantic and public-data only", () => {
    expect(brandHero).toContain("<section");
    expect(brandHero).toContain("<h1");
    expect(categoryTile).toContain("Link");
    expect(categoryTile).toContain("w-24");
    expect(categoryTile).toContain("CategoryIcon");
    expect(nearbyServiceRail).toContain("ServiceCard");
    expect(nearbyServiceRail).toContain("aria-label");
    for (const file of [brandHero, categoryTile, nearbyServiceRail]) {
      expect(file).not.toContain("verific");
    }
  });
});
