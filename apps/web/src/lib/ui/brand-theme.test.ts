import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globals = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const layout = readFileSync(
  new URL("../../app/layout.tsx", import.meta.url),
  "utf8",
);
const icon = readFileSync(
  new URL("../../app/icon.svg", import.meta.url),
  "utf8",
);
const badgeSources = [
  "../../app/(account)/messages/page.tsx",
  "../../components/ui/nav-with-counts.tsx",
  "../../components/ui/authenticated-bottom-nav.tsx",
]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n");

describe("YALO brand theme", () => {
  it("uses Space Grotesk + Inter as product typefaces", () => {
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain("Space_Grotesk");
    expect(layout).toContain("Inter");
    expect(globals).toMatch(/--font-display:\s*var\(--font-space-grotesk\)/);
    expect(globals).toMatch(/--font-sans:\s*var\(--font-inter\)/);
    expect(globals).not.toContain("Bricolage");
  });

  it("uses the approved YALO palette as the global visual foundation", () => {
    expect(globals).toContain("--color-canvas: #f6f9fc");
    expect(globals).toContain("--color-ink: #101827");
    expect(globals).toContain("--color-brand-primary: #161d2a");
    expect(globals).toContain("--color-brand-primary-strong: #0d121b");
    expect(globals).toContain("--color-focus: #1576d2");
    expect(globals).toContain("--yalo-symbol-gradient");
  });

  it("uses navy primary actions and reserves blue for functional contrast", () => {
    expect(globals).toMatch(/\.button-primary[\s\S]*background:\s*#161d2a/i);
    expect(globals).toMatch(/\.button-primary[\s\S]*color:\s*#ffffff/i);
    expect(globals).toMatch(
      /:focus-visible[\s\S]*outline:\s*2px solid #1576d2/i,
    );
  });

  it("uses accessible semantic derivatives instead of brand colors for small status text", () => {
    expect(globals).toContain("--color-warning: #9a6500");
    expect(globals).toContain("--color-danger: #c83d46");
  });

  it("uses the danger token for unread-count badges, never brand pink", () => {
    expect(badgeSources).not.toMatch(/bg-brand-pink(?=\s|\")/);
    expect(badgeSources).toMatch(/bg-danger/);
  });

  it("uses the YALO symbol artwork for the app icon", () => {
    expect(globals).toContain('background-image: url("/brand/yalo-symbol.svg")');
    expect(icon).toContain("#0D121B");
    expect(icon).toContain("#08A9F4");
    expect(icon).toContain("#12D9C5");
    expect(icon).toContain("#65EC91");
    expect(icon).not.toContain("#FF6B35");
    expect(icon).not.toContain("#FF0A78");
  });

  it("retires the previous warm brand colors", () => {
    expect(globals).not.toMatch(/#ff6b35/i);
    expect(globals).not.toMatch(/#ff0a78/i);
    expect(globals).not.toMatch(/#ffc857/i);
    expect(globals).not.toMatch(/#163832/i);
  });
});
