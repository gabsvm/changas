export const requiredIdentityDocumentTypes = [
  "DNI_FRONT",
  "DNI_BACK",
  "SELFIE",
] as const;

export type RequiredIdentityDocumentType =
  (typeof requiredIdentityDocumentTypes)[number];

type DocumentLike = { document_type: string };

export function hasRequiredIdentityDocuments(
  documents: readonly DocumentLike[],
): boolean {
  const received = new Set(documents.map((document) => document.document_type));
  return requiredIdentityDocumentTypes.every((type) => received.has(type));
}

export function missingRequiredIdentityDocuments(
  documents: readonly DocumentLike[],
): RequiredIdentityDocumentType[] {
  const received = new Set(documents.map((document) => document.document_type));
  return requiredIdentityDocumentTypes.filter((type) => !received.has(type));
}
