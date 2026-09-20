import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../app/(account)/jobs/[jobId]/page.tsx", import.meta.url),
  "utf8",
);

const listSource = readFileSync(
  new URL("../../app/(account)/jobs/page.tsx", import.meta.url),
  "utf8",
);

describe("job detail marketplace UI", () => {
  it("uses human status and modality helpers", () => {
    expect(source).toContain("getJobStatusPresentation");
    expect(source).toContain("getServiceModalityLabel");
    expect(source).not.toContain('detail.modality.replaceAll("_", " ")');
  });

  it("leads with the next action and collapses secondary sections", () => {
    expect(source).toContain("Próxima acción");
    expect(source).toContain("nextTransition");
    expect(source).toContain("Ver chat");
    expect(source).toContain("collapsible");
    expect(source).toContain("border-l-2");
  });

  it("shows amounts, next actions and status filters in the job list", () => {
    expect(listSource).toContain("jobAmount");
    expect(listSource).toContain("nextAction");
    expect(listSource).toContain("status=");
    expect(listSource).toContain("aria-label=");
    expect(listSource).toContain("Sin trabajos en este estado");
  });

  it("avoids giant nested card chrome", () => {
    expect(source).not.toContain("rounded-[2rem]");
    expect(source).not.toContain("rounded-3xl");
    expect(source).not.toContain("shadow-[0_20px_70px");
  });
});
