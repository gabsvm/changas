import { describe, expect, it } from "vitest";

import {
  getDocumentTypeLabel,
  validateIdentityFileMetadata,
} from "./documents";

describe("getDocumentTypeLabel", () => {
  it("maps persisted document types to human labels", () => {
    expect(getDocumentTypeLabel("DNI_FRONT")).toBe("DNI frente");
    expect(getDocumentTypeLabel("DNI_BACK")).toBe("DNI dorso");
    expect(getDocumentTypeLabel("SELFIE")).toBe("Selfie de validación");
  });
});

describe("validateIdentityFileMetadata", () => {
  it("accepts supported files at or below 10 MiB", () => {
    expect(
      validateIdentityFileMetadata({
        type: "image/jpeg",
        size: 10 * 1024 * 1024,
      }),
    ).toEqual({ valid: true });
  });

  it("rejects unsupported MIME types", () => {
    expect(
      validateIdentityFileMetadata({ type: "image/gif", size: 1000 }),
    ).toEqual({
      valid: false,
      reason: "Formato no admitido. Usá JPG, PNG o PDF.",
    });
  });

  it("rejects files larger than 10 MiB", () => {
    expect(
      validateIdentityFileMetadata({
        type: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
      }),
    ).toEqual({
      valid: false,
      reason: "El archivo supera el límite de 10 MiB.",
    });
  });
});
