import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const icon = read("../../components/ui/marketplace/action-arrow-icon.tsx");
const home = read("../../app/page.tsx");
const styles = read("../../app/yalo-showcase.css");
const categories = read("../../components/ui/marketplace/category-tile.tsx");
const categoryStyles = read("../../app/yalo-category-photography.css");
const serviceCard = read("../../components/ui/marketplace/service-card.tsx");

describe("Better Design — directional CTA and button polish", () => {
  it("draws arrows from one native YALO vector, with accessible decorative semantics", () => {
    expect(icon).toContain('aria-hidden="true"');
    expect(icon).toContain('focusable="false"');
    expect(icon).toContain('stroke="currentColor"');
    expect(icon).toContain('strokeWidth="2.2"');
    expect(icon).toContain('d="M6 18 18 6M8 6h10v10"');
    expect(home).toContain("<ActionArrowIcon />");
    expect(home).not.toContain('strokeWidth="1.9"');
    expect(categories).toContain("<ActionArrowIcon />");
    expect(serviceCard).toContain(
      '<ActionArrowIcon className="ml-1 h-4 w-4 shrink-0" />',
    );
    expect(serviceCard).not.toContain('<span aria-hidden="true">→</span>');
  });

  it("uses balanced icon vessels with hover and focus, respects reduced motion", () => {
    expect(styles).toContain(".yalo-showcase .yalo-intent-arrow {");
    expect(styles).toContain("flex: 0 0 2.125rem");
    expect(styles).toContain(".yalo-showcase .yalo-section-link > span {");
    expect(styles).toContain("focus-visible .yalo-action-arrow");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(categoryStyles).toContain(
      ".yalo-showcase .yalo-category-photo-arrow .yalo-action-arrow",
    );
    expect(categoryStyles).toContain("width: 1rem");
  });

  it("does not imply navigation through non-interactive trust or benefit badges", () => {
    expect(home).toMatch(
      /className="yalo-value-glyph" aria-hidden="true">\s*✦\s*<\/span>/,
    );
    expect(home).toContain('className="yalo-confidence-icon">✓</span>');
    expect(home).toMatch(
      /className="yalo-eyebrow-arrow" aria-hidden="true">\s*✦\s*<\/span>/,
    );
  });
});
