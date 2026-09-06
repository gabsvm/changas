import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, it } from "vitest";
import { format, resolveConfig } from "prettier";

const files = [
  "apps/web/scripts/phase-11-payments-runtime.mjs",
  "apps/web/src/app/admin/payments/page.tsx",
  "apps/web/src/lib/payments/admin.test.ts",
  "apps/web/src/lib/payments/server-admin.ts",
  "apps/web/src/lib/payments/server-reconciliation.ts",
  "tests/e2e/phase-11-payments.spec.ts",
];

describe("Phase 11 formatter dump", () => {
  it("emits repository-exact Prettier output", async () => {
    const config = (await resolveConfig(resolve(files[0]!))) ?? {};
    for (const file of files) {
      const source = await readFile(resolve(file), "utf8");
      const formatted = await format(source, { ...config, filepath: resolve(file) });
      console.log(
        `PHASE11_FORMAT:${file}:${Buffer.from(formatted).toString("base64")}`,
      );
    }
  });
});
