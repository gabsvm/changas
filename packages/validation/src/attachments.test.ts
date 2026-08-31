import { describe, expect, it } from "vitest";

import {
  conversationAttachmentSchema,
  sanitizeAttachmentFilename,
} from "./index";

describe("conversationAttachmentSchema", () => {
  it("accepts supported image and file metadata within limits", () => {
    expect(
      conversationAttachmentSchema.safeParse({
        kind: "IMAGE",
        mimeType: "image/webp",
        fileSizeBytes: 1024,
        originalName: "foto.webp",
      }).success,
    ).toBe(true);
    expect(
      conversationAttachmentSchema.safeParse({
        kind: "FILE",
        mimeType: "application/pdf",
        fileSizeBytes: 10 * 1024 * 1024,
        originalName: "presupuesto.pdf",
      }).success,
    ).toBe(true);
  });

  it("rejects mismatched MIME, oversized files and names over 180 chars", () => {
    expect(
      conversationAttachmentSchema.safeParse({
        kind: "IMAGE",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
        originalName: "archivo.pdf",
      }).success,
    ).toBe(false);
    expect(
      conversationAttachmentSchema.safeParse({
        kind: "FILE",
        mimeType: "application/pdf",
        fileSizeBytes: 10 * 1024 * 1024 + 1,
        originalName: "archivo.pdf",
      }).success,
    ).toBe(false);
    expect(
      conversationAttachmentSchema.safeParse({
        kind: "FILE",
        mimeType: "text/plain",
        fileSizeBytes: 100,
        originalName: `${"a".repeat(181)}.txt`,
      }).success,
    ).toBe(false);
  });
});

describe("sanitizeAttachmentFilename", () => {
  it("removes path traversal and unsafe characters while preserving a readable name", () => {
    expect(sanitizeAttachmentFilename("../../Mi comprobante (final) #1.pdf")).toBe(
      "Mi-comprobante-final-1.pdf",
    );
  });

  it("returns a bounded fallback when the name has no usable characters", () => {
    expect(sanitizeAttachmentFilename("../../....")).toBe("archivo");
    expect(sanitizeAttachmentFilename(`${"á".repeat(250)}.pdf`).length).toBeLessThanOrEqual(
      180,
    );
  });
});
