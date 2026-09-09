import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layout = readFileSync(
  new URL("../../app/layout.tsx", import.meta.url),
  "utf8",
);
const compression = readFileSync(
  new URL("../media/image-compression.ts", import.meta.url),
  "utf8",
);

describe("global image upload compression", () => {
  it("does not rely on a document-level event interceptor", () => {
    expect(layout).not.toContain("ImageUploadCompressionGuard");
    expect(compression).toContain("compressInputFiles");
  });

  it("uses one shared input pipeline for image uploads", () => {
    expect(compression).toContain("compressImageForUpload");
    expect(compression).toContain("DataTransfer");
  });
});
