import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { format } from "prettier";

const targets = [
  "apps/web/src/lib/ui/documents.ts",
  "apps/web/src/lib/ui/onboarding.ts",
  "apps/web/src/lib/ui/provider-status.ts",
  "docs/superpowers/plans/2026-09-07-mobile-premium-redesign.md",
];

describe("temporary prettier dump", () => {
  it("prints canonical formatting", async () => {
    for (const path of targets) {
      const source = await readFile(path, "utf8");
      const formatted = await format(source, { filepath: path });
      console.log(`FORMAT_START:${path}\n${formatted}FORMAT_END:${path}`);
    }

    expect(true).toBe(false);
  });
});
