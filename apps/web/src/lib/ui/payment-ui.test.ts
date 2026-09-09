import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../components/payments/provider-payment-account.tsx", import.meta.url),
  "utf8",
);

describe("provider payment account UI", () => {
  it("uses compact settings presentation", () => {
    expect(source).toContain("StatusChip");
    expect(source).not.toContain("rounded-2xl border bg-white/70 p-6");
    expect(source).not.toContain("text-3xl");
  });
});
