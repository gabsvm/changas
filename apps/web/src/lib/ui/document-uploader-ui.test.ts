import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../components/provider/document-uploader.tsx", import.meta.url),
  "utf8",
);

describe("identity document uploader UI", () => {
  it("avoids oversized nested-card presentation", () => {
    expect(source).not.toContain("rounded-3xl");
    expect(source).not.toContain("text-2xl");
    expect(source).not.toContain("shadow-[0_10px_30px");
  });

  it("keeps camera, file and private-upload behavior", () => {
    expect(source).toContain('openPicker("camera")');
    expect(source).toContain('openPicker("file")');
    expect(source).toContain('from("identity-documents")');
  });
});
