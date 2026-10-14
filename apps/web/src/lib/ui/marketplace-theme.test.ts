import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("marketplace consumer theme", () => {
  it("defines compact consumer surface tokens", () => {
    expect(css).toContain("--consumer-page-padding: 1rem");
    expect(css).toContain("--consumer-radius-card: 1rem");
    expect(css).toContain("--consumer-nav-height: 4rem");
    expect(css).toContain("consumer-pressable");
    expect(css).toContain("--sticky-offset");
  });

  it("uses the approved YALO brand colors", () => {
    expect(css).toContain("--color-canvas: #f6f9fc");
    expect(css).toContain("--color-ink: #101827");
    expect(css).toContain("--color-brand-primary: #161d2a");
    expect(css).toContain("--color-brand-primary-strong: #0d121b");
    expect(css).toContain("--color-focus: #1576d2");
    expect(css).toContain("--color-danger: #c83d46");
    expect(css).not.toMatch(/--color-brand-orange:\s*#ff6b35/i);
    expect(css).not.toMatch(/--color-brand-pink:\s*#ff0a78/i);
  });

  it("defines soft layered marketplace depth tokens", () => {
    expect(css).toContain("--consumer-shadow-card");
    expect(css).toContain("--consumer-shadow-float");
    expect(css).toContain("--consumer-hero-gradient");
  });
});
