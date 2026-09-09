import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const providerPage = source("../../app/p/[slug]/page.tsx");
const servicePage = source("../../app/p/[slug]/[serviceSlug]/page.tsx");

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
});
