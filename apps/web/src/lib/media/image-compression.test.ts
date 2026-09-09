import { describe, expect, it } from "vitest";

import {
  IMAGE_COMPRESSION_MAX_DIMENSION,
  IMAGE_COMPRESSION_TARGET_BYTES,
  buildCompressedImageName,
  isCompressibleImageType,
} from "./image-compression";

describe("image upload compression contract", () => {
  it("targets roughly 100 KiB with the same 1200px visual envelope used by Smart Intercom", () => {
    expect(IMAGE_COMPRESSION_TARGET_BYTES).toBe(100 * 1024);
    expect(IMAGE_COMPRESSION_MAX_DIMENSION).toBe(1200);
  });

  it("compresses browser-decodable raster image formats but leaves documents alone", () => {
    expect(isCompressibleImageType("image/jpeg")).toBe(true);
    expect(isCompressibleImageType("image/png")).toBe(true);
    expect(isCompressibleImageType("image/webp")).toBe(true);
    expect(isCompressibleImageType("image/heic")).toBe(true);
    expect(isCompressibleImageType("image/heif")).toBe(true);
    expect(isCompressibleImageType("image/svg+xml")).toBe(false);
    expect(isCompressibleImageType("application/pdf")).toBe(false);
  });

  it("normalizes compressed uploads to a safe jpeg filename", () => {
    expect(buildCompressedImageName("DNI frente.png")).toBe("DNI_frente.jpg");
    expect(buildCompressedImageName("foto.final.WEBP")).toBe("foto.final.jpg");
  });
});
