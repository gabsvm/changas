import { describe, expect, it } from "vitest";

import {
  hasRequiredIdentityDocuments,
  missingRequiredIdentityDocuments,
  requiredIdentityDocumentTypes,
} from "./provider-submission";

describe("provider identity submission", () => {
  it("requires DNI front, DNI back and selfie before review submission", () => {
    expect(requiredIdentityDocumentTypes).toEqual([
      "DNI_FRONT",
      "DNI_BACK",
      "SELFIE",
    ]);
    expect(
      hasRequiredIdentityDocuments([
        { document_type: "DNI_FRONT" },
        { document_type: "DNI_BACK" },
      ]),
    ).toBe(false);
    expect(
      hasRequiredIdentityDocuments([
        { document_type: "DNI_FRONT" },
        { document_type: "DNI_BACK" },
        { document_type: "SELFIE" },
      ]),
    ).toBe(true);
  });

  it("reports exactly which required documents are missing", () => {
    expect(
      missingRequiredIdentityDocuments([{ document_type: "DNI_FRONT" }]),
    ).toEqual(["DNI_BACK", "SELFIE"]);
  });
});
