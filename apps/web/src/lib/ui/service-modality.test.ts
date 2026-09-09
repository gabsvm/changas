import { describe, expect, it } from "vitest";

import { getServiceModalityLabel } from "./service-modality";

describe("getServiceModalityLabel", () => {
  it("humanizes every marketplace modality", () => {
    expect(getServiceModalityLabel("IN_PERSON")).toBe("Presencial");
    expect(getServiceModalityLabel("REMOTE")).toBe("Remoto");
    expect(getServiceModalityLabel("BOTH")).toBe("Presencial o remoto");
  });

  it("does not leak an unknown raw enum", () => {
    expect(getServiceModalityLabel("SOMETHING_NEW")).toBe("Modalidad a coordinar");
  });
});
