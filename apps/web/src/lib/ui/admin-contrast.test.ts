import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../app/admin/admin.css", import.meta.url),
  "utf8",
);
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
describe("admin contrast", () => {
  it("keeps placeholder text and focus indicators readable in both themes", () => {
    expect(css).toContain("color: #626b78");
    expect(css).toContain("color: #9aaac0");
    expect(css).toContain("outline: 2px solid #087681");
    expect(css).toContain("outline-color: #7bf2e7");
    expect(contrast("#626b78", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#9aaac0", "#0d131d")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#087681", "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast("#7bf2e7", "#0d131d")).toBeGreaterThanOrEqual(3);
  });
});
