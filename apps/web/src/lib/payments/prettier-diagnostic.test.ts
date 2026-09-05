import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { format, resolveConfig } from "prettier";
import { expect, it } from "vitest";

const targets = [
  "apps/web/src/lib/payments/mercado-pago.test.ts",
  "apps/web/src/lib/payments/mercado-pago.ts",
];

it("prints the exact Prettier diff for Phase 11 payment files", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "changas-prettier-"));
  const diffs: string[] = [];

  try {
    for (const target of targets) {
      const source = readFileSync(target, "utf8");
      const config = (await resolveConfig(target)) ?? {};
      const formatted = await format(source, { ...config, filepath: target });
      const formattedPath = join(tempDirectory, basename(target));
      writeFileSync(formattedPath, formatted, "utf8");

      if (source !== formatted) {
        try {
          execFileSync("diff", ["-u", target, formattedPath], {
            encoding: "utf8",
          });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "stdout" in error &&
            typeof error.stdout === "string"
          ) {
            diffs.push(`TARGET ${target}\n${error.stdout}`);
          } else {
            throw error;
          }
        }
      }
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  expect(diffs, diffs.join("\n")).toEqual([]);
});
