import { describe, expect, it } from "vitest";

import {
  formatServicePrice,
  minorUnitsToMajorInput,
  parseMajorAmountToMinor,
  parseServicePrice,
} from "./money";

describe("money helpers", () => {
  it("converts major ARS input to authoritative minor units", () => {
    expect(parseMajorAmountToMinor("12500", "ARS")).toBe(1_250_000);
    expect(parseMajorAmountToMinor("125.50", "ARS")).toBe(12_550);
    expect(minorUnitsToMajorInput(1_250_000, "ARS")).toBe("12500");
    expect(minorUnitsToMajorInput(12_550, "ARS")).toBe("125.5");
  });

  it("formats every Phase 02 pricing model from minor units", () => {
    expect(formatServicePrice("FIXED", 1_250_000, "ARS", null)).toBe("$12.500");
    expect(formatServicePrice("STARTING_AT", 900_000, "ARS", null)).toBe(
      "Desde $9.000",
    );
    expect(formatServicePrice("HOURLY", 1_500_000, "ARS", null)).toBe(
      "$15.000 / hora",
    );
    expect(formatServicePrice("PER_UNIT", 750_000, "ARS", "equipo")).toBe(
      "$7.500 / equipo",
    );
    expect(formatServicePrice("QUOTE", null, "ARS", null)).toBe("A cotizar");
  });

  it("parses quote and rejects invalid, negative, unsupported, or unsafe values", () => {
    expect(parseServicePrice("QUOTE", "", "ARS")).toBeNull();
    expect(() => parseServicePrice("QUOTE", "100", "ARS")).toThrow();
    expect(() => parseMajorAmountToMinor("0", "ARS")).toThrow();
    expect(() => parseMajorAmountToMinor("-1", "ARS")).toThrow();
    expect(() => parseMajorAmountToMinor("1.234", "ARS")).toThrow();
    expect(() => parseMajorAmountToMinor("90071992547409.92", "ARS")).toThrow();
    expect(() => parseMajorAmountToMinor("100", "USD")).toThrow();
  });
});
