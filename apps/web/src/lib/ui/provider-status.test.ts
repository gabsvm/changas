import { describe, expect, it } from "vitest";

import { getProviderStatusPresentation } from "./provider-status";

describe("getProviderStatusPresentation", () => {
  it("maps PROFILE_INCOMPLETE to human copy", () => {
    expect(getProviderStatusPresentation("PROFILE_INCOMPLETE").label).toBe(
      "Perfil incompleto",
    );
  });

  it("maps IDENTITY_PENDING without leaking the raw enum", () => {
    const presentation = getProviderStatusPresentation("IDENTITY_PENDING");

    expect(presentation.label).toBe("En revisión");
    expect(presentation.label).not.toBe("IDENTITY_PENDING");
    expect(presentation.tone).toBe("warning");
  });

  it("maps ACTIVE to an active success presentation", () => {
    expect(getProviderStatusPresentation("ACTIVE")).toMatchObject({
      label: "Activo",
      tone: "success",
    });
  });

  it("uses safe human copy for unknown values", () => {
    const presentation = getProviderStatusPresentation("SOMETHING_NEW");

    expect(presentation.label).toBe("Estado de cuenta");
    expect(presentation.label).not.toContain("SOMETHING_NEW");
  });
});
