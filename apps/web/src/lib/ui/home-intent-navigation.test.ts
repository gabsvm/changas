import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");
const home = read("../../app/page.tsx");
const styles = read("../../app/yalo-showcase.css");

describe("home: obvious hire or work entrypoints", () => {
  it("shows both user intents in the hero before search and discovery", () => {
    const stage = home.indexOf('className="yalo-stage"');
    const choices = home.indexOf('className="yalo-intent"');
    const search = home.indexOf('className="yalo-hero-search"');
    const categories = home.indexOf('className="yalo-category-section"');
    // Classes can share a longer className expression; compare section markers instead.
    expect(stage).toBeGreaterThan(-1);
    expect(choices).toBeGreaterThan(stage);
    expect(search).toBeGreaterThan(choices);
    expect(categories).toBeGreaterThan(search);
    expect((home.match(/Quiero contratar/g) ?? [])).toHaveLength(1);
    expect((home.match(/Quiero trabajar/g) ?? [])).toHaveLength(1);
    expect(home).not.toContain("yalo-final-cta");
  });

  it("preserves clear navigation to discovery and provider onboarding", () => {
    expect(home).toContain('<Link href="/buscar" className="yalo-intent-link yalo-intent-hire">');
    expect(home).toContain('href="/provider/onboarding"\n                  className="yalo-intent-link yalo-intent-work"');
    expect(home).toContain('aria-label="Elegí qué querés hacer en YALO"');
    expect(home).toContain('action="/buscar"');
    expect(home).toContain('name="q"');
  });

  it("provides generous touch targets and a single-column phone layout", () => {
    expect(styles).toContain(".yalo-intent-link {");
    expect(styles).toContain("min-height: 90px;");
    expect(styles).toContain("min-height: 70px;");
    expect(styles).toContain(".yalo-intent-actions {\n    grid-template-columns: minmax(0, 1fr);");
    expect(styles).not.toContain(".yalo-final-cta");
  });

  it("keeps text-to-background contrast at least WCAG AA", () => {
    const luma = (hex: string) => {
      const rgb = [1, 3, 5].map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luma(a), luma(b)].sort((a, b) => b - a);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    for (const stop of ["#08a9f4", "#12d9c5", "#65ec91"]) {
      expect(ratio("#062333", stop)).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio("#f5f8fc", "#1e3141")).toBeGreaterThanOrEqual(4.5);
  });
});
