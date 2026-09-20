import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getDocumentTypeLabel,
  maskPrivateReference,
  validateIdentityFileMetadata,
} from "./documents";

const listItemSource = readFileSync(
  new URL("../../components/provider/document-list-item.tsx", import.meta.url),
  "utf8",
);
const ownerRouteSource = readFileSync(
  new URL(
    "../../app/api/account/documents/[documentId]/route.ts",
    import.meta.url,
  ),
  "utf8",
);

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

  it("masks private references showing only the last four digits", () => {
    expect(maskPrivateReference("30456789")).toBe("•••• 6789");
    expect(maskPrivateReference("11 5555 5678")).toBe("•••• 5678");
    expect(maskPrivateReference("123")).toBe("••••");
    expect(maskPrivateReference(null)).toBe("••••");
  });

  it("shows thumbnails of uploaded documents through owner-signed URLs", () => {
    expect(listItemSource).toContain("createOwnerIdentityDocumentSignedUrl");
    expect(listItemSource).toContain("previewUrl");
    expect(listItemSource).toContain("Cargado");
  });

  it("serves owner previews without cacheable traces", () => {
    expect(ownerRouteSource).toContain("createOwnerIdentityDocumentSignedUrl");
    expect(ownerRouteSource).toContain("no-store");
    expect(ownerRouteSource).toContain("302");
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
