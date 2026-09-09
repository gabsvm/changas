import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const guard = readFileSync(
  new URL("../../components/media/image-upload-compression-guard.tsx", import.meta.url),
  "utf8",
);

describe("global image upload compression", () => {
  it("mounts one guard at the application root so every image file input is covered", () => {
    expect(layout).toContain("ImageUploadCompressionGuard");
    expect(layout).toContain("<ImageUploadCompressionGuard />");
  });

  it("compresses selected image files before any form can submit them", () => {
    expect(guard).toContain('document.addEventListener("change"');
    expect(guard).toContain('document.addEventListener("submit"');
    expect(guard).toContain("compressImageForUpload");
    expect(guard).toContain("DataTransfer");
  });
});
