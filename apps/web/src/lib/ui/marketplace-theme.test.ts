import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("marketplace consumer theme", () => {
  it("defines compact consumer surface tokens", () => {
    expect(css).toContain("--consumer-page-padding: 1rem");
    expect(css).toContain("--consumer-radius-card: 0.875rem");
    expect(css).toContain("--consumer-nav-height: 4rem");
    expect(css).toContain("consumer-pressable");
  });

  it("uses the approved Changas brand colors", () => {
    expect(css).toContain("--color-canvas: #fff9f3");
    expect(css).toContain("--color-ink: #202124");
    expect(css).toContain("--color-brand-orange: #ff6b35");
    expect(css).toContain("--color-brand-yellow: #ffc857");
    expect(css).toContain("--color-brand-pink: #ff0a78");
    expect(css).toContain("--color-brand-pink-strong: #d60060");
    expect(css).toContain("--color-moss: #2563eb");
  });

  it("defines warm layered marketplace depth tokens", () => {
    expect(css).toContain("--consumer-shadow-card");
    expect(css).toContain("--consumer-shadow-float");
    expect(css).toContain("--consumer-hero-gradient");
  });
});
