import { describe, expect, it } from "vitest";

import { parseArsMinorUnits } from "./index";

describe("parseArsMinorUnits", () => {
  it("parses es-AR amounts into minor units", () => {
    expect(parseArsMinorUnits("1.234,56")).toBe(123456);
    expect(parseArsMinorUnits("100")).toBe(10000);
    expect(parseArsMinorUnits("80.000,50")).toBe(8000050);
    expect(parseArsMinorUnits("0,01")).toBe(1);
    expect(parseArsMinorUnits("1500,5")).toBe(150050);
    expect(parseArsMinorUnits("1.000.000")).toBe(100000000);
  });

  it("trims surrounding whitespace", () => {
    expect(parseArsMinorUnits("  250,10  ")).toBe(25010);
  });

  it("returns undefined for empty or blank input", () => {
    expect(parseArsMinorUnits("")).toBeUndefined();
    expect(parseArsMinorUnits("   ")).toBeUndefined();
  });

  it("rejects more than two decimals", () => {
    expect(parseArsMinorUnits("10,123")).toBeUndefined();
  });

  it("rejects zero and negative amounts", () => {
    expect(parseArsMinorUnits("0")).toBeUndefined();
    expect(parseArsMinorUnits("0,00")).toBeUndefined();
    expect(parseArsMinorUnits("-500")).toBeUndefined();
  });

  it("rejects non numeric, inner whitespace and malformed separators", () => {
    expect(parseArsMinorUnits("abc")).toBeUndefined();
    expect(parseArsMinorUnits("1 000")).toBeUndefined();
    expect(parseArsMinorUnits("10,5,5")).toBeUndefined();
    expect(parseArsMinorUnits("10,")).toBeUndefined();
    expect(parseArsMinorUnits(",50")).toBeUndefined();
    expect(parseArsMinorUnits("1e5")).toBeUndefined();
  });

  it("rejects amounts outside the safe integer range", () => {
    expect(parseArsMinorUnits("99999999999999999999")).toBeUndefined();
  });
});
