import { readFile } from "node:fs/promises";

import { format } from "prettier";
import { describe, expect, it } from "vitest";

const targets = [
  "apps/web/src/app/(account)/account/page.tsx",
  "apps/web/src/app/(account)/account/settings/page.tsx",
  "apps/web/src/app/(provider)/provider/onboarding/page.tsx",
  "apps/web/src/app/(provider)/provider/onboarding/profile/page.tsx",
];

describe("temporary prettier mobile dump", () => {
  it("prints canonical formatting for batch one", async () => {
    for (const path of targets) {
      const source = await readFile(path, "utf8");
      const formatted = await format(source, { filepath: path });
      console.log(`FORMAT_START:${path}\n${formatted}FORMAT_END:${path}`);
    }

    expect(true).toBe(false);
  });
});
