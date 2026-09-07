export const identityDocumentMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export const identityDocumentMaxBytes = 10 * 1024 * 1024;

const documentLabels: Record<string, string> = {
  DNI_FRONT: "DNI frente",
  DNI_BACK: "DNI dorso",
  SELFIE: "Selfie de validación",
};

export function getDocumentTypeLabel(type: string): string {
  return documentLabels[type] ?? "Documento";
}

export type IdentityFileValidation =
  { valid: true } | { valid: false; reason: string };

export function validateIdentityFileMetadata(input: {
  type: string;
  size: number;
}): IdentityFileValidation {
  if (
    !identityDocumentMimeTypes.includes(
      input.type as (typeof identityDocumentMimeTypes)[number],
    )
  ) {
    return {
      valid: false,
      reason: "Formato no admitido. Usá JPG, PNG o PDF.",
    };
  }

  if (input.size > identityDocumentMaxBytes) {
    return {
      valid: false,
      reason: "El archivo supera el límite de 10 MiB.",
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}
