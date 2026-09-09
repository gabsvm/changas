import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../app/(account)/jobs/[jobId]/page.tsx", import.meta.url),
  "utf8",
);

describe("job detail marketplace UI", () => {
  it("uses human status and modality helpers", () => {
    expect(source).toContain("getJobStatusPresentation");
    expect(source).toContain("getServiceModalityLabel");
    expect(source).not.toContain('detail.modality.replaceAll("_", " ")');
  });

  it("avoids giant nested card chrome", () => {
    expect(source).not.toContain("rounded-[2rem]");
    expect(source).not.toContain("rounded-3xl");
    expect(source).not.toContain("shadow-[0_20px_70px");
  });
});
