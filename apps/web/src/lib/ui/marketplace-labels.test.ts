import { describe, expect, it } from "vitest";

import {
  formatDistanceMeters,
  getModalityLabel,
  getPriceModelLabel,
} from "./marketplace-labels";

describe("marketplace presentation labels", () => {
  it.each([
    ["IN_PERSON", "Presencial"],
    ["REMOTE", "Remoto"],
    ["BOTH", "Presencial o remoto"],
  ])("humanizes modality %s", (value, label) => {
    expect(getModalityLabel(value)).toBe(label);
  });

  it.each([
    ["FIXED", "Precio fijo"],
    ["STARTING_AT", "Desde"],
    ["HOURLY", "Por hora"],
    ["PER_UNIT", "Por unidad"],
    ["QUOTE", "A cotizar"],
  ])("humanizes price model %s", (value, label) => {
    expect(getPriceModelLabel(value)).toBe(label);
  });

  it("formats distance for people instead of exposing raw meters", () => {
    expect(formatDistanceMeters(null)).toBeNull();
    expect(formatDistanceMeters(850)).toBe("850 m");
    expect(formatDistanceMeters(4200)).toBe("4,2 km");
  });
});
