import { describe, expect, it } from "vitest";

import { formatProductDateTime, parseProductDateTime } from "./product-time";

describe("product time zone", () => {
  it("interprets datetime-local input as Buenos Aires wall time", () => {
    const originalTz = process.env.TZ;
    try {
      for (const timezone of ["UTC", "America/Argentina/Buenos_Aires"]) {
        process.env.TZ = timezone;
        expect(parseProductDateTime("2030-05-10T09:00")?.toISOString()).toBe(
          "2030-05-10T12:00:00.000Z",
        );
        expect(formatProductDateTime("2030-05-10T12:00:00.000Z")).toMatch(
          /9:00/,
        );
      }
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it("keeps an explicit offset as an absolute instant", () => {
    expect(parseProductDateTime("2030-05-10T09:00+02:00")?.toISOString()).toBe(
      "2030-05-10T07:00:00.000Z",
    );
  });

  it("preserves seconds and milliseconds and accepts leap days", () => {
    expect(parseProductDateTime("2030-05-10T09:00:30.125")?.toISOString()).toBe(
      "2030-05-10T12:00:30.125Z",
    );
    expect(parseProductDateTime("2032-02-29T09:00")?.toISOString()).toBe(
      "2032-02-29T12:00:00.000Z",
    );
  });

  it.each([
    "2030-02-30T09:00",
    "2031-02-29T09:00",
    "2030-05-10T24:00",
    "2030-05-10T09:00+24:00",
    "not-a-date",
  ])("rejects invalid calendar or offset input: %s", (value) => {
    expect(parseProductDateTime(value)).toBeNull();
  });
});
