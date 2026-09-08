import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globals = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const icon = readFileSync(
  new URL("../../app/icon.svg", import.meta.url),
  "utf8",
);
const badgeSources = [
  "../../app/(account)/messages/page.tsx",
  "../../app/(account)/layout.tsx",
  "../../app/(provider)/layout.tsx",
  "../../components/ui/authenticated-bottom-nav.tsx",
]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n");

describe("Changas brand theme", () => {
  it("uses the approved Changas palette as the global visual foundation", () => {
    expect(globals).toContain("--color-canvas: #fff9f3");
    expect(globals).toContain("--color-ink: #202124");
    expect(globals).toContain("--color-brand-orange: #ff6b35");
    expect(globals).toContain("--color-brand-yellow: #ffc857");
    expect(globals).toContain("--color-moss: #2563eb");
  });

  it("keeps primary actions warm and reserves blue for functional contrast", () => {
    expect(globals).toMatch(/\.button-primary[\s\S]*background:\s*#ff6b35/i);
    expect(globals).toMatch(/\.button-primary[\s\S]*color:\s*#202124/i);
    expect(globals).toMatch(
      /:focus-visible[\s\S]*outline:\s*2px solid #2563eb/i,
    );
  });

  it("uses accessible semantic derivatives instead of bright brand colors for small status text", () => {
    expect(globals).toContain("--color-terracotta: #c84010");
    expect(globals).toContain("--color-warning: #9a6500");
    expect(globals).toContain("--color-brand-pink-strong: #d60060");
  });

  it("uses the accessible pink derivative for unread-count badges", () => {
    expect(badgeSources).not.toMatch(/bg-brand-pink(?=\s|\")/);
    expect(badgeSources.match(/bg-brand-pink-strong/g)).toHaveLength(4);
  });

  it("uses the branded icon artwork for compact wordmarks", () => {
    expect(globals).toContain('background-image: url("/icon.svg")');
    expect(icon).toContain("#FFC857");
    expect(icon).toContain("#FF6B35");
    expect(icon).toContain("#FF0A78");
  });

  it("retires the previous green and terracotta brand colors", () => {
    expect(globals).not.toContain("#163832");
    expect(globals).not.toContain("#285943");
    expect(globals).not.toContain("#b86145");
  });
});
