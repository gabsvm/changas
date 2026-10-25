import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");
const home = read("../../app/page.tsx");
const styles = read("../../app/yalo-showcase.css");

describe("home: single primary search with a discrete work entrypoint", () => {
  it("shows one primary search before shortcuts and keeps work secondary", () => {
    const stage = home.indexOf('className="yalo-stage"');
    const search = home.indexOf('className="yalo-hero-search"');
    const offer = home.indexOf('className="yalo-hero-offer"');
    const shortcuts = home.indexOf('className="yalo-hero-shortcuts"');
    const categories = home.indexOf(
      'className="yalo-home-section yalo-category-section"',
    );
    // Classes can share a longer className expression; compare section markers instead.
    expect(stage).toBeGreaterThan(-1);
    expect(search).toBeGreaterThan(stage);
    expect(offer).toBeGreaterThan(search);
    expect(shortcuts).toBeGreaterThan(offer);
    expect(categories).toBeGreaterThan(shortcuts);
    expect(home).not.toContain("Quiero contratar");
    expect(home).not.toContain("Quiero trabajar");
    expect(home).not.toContain("yalo-final-cta");
  });

  it("preserves clear navigation to discovery and provider onboarding", () => {
    expect(home).toContain('href="/provider/onboarding"');
    expect(home).toContain("Ofrecer mis servicios");
    expect(home).toContain('action="/buscar"');
    expect(home).toContain('name="q"');
  });

  it("provides generous touch targets and a single-column phone layout", () => {
    expect(styles).toContain(".yalo-intent-link {");
    expect(styles).toContain("min-height: 90px;");
    expect(styles).toContain("min-height: 70px;");
    expect(styles).toMatch(
      /\.yalo-intent-actions\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
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
