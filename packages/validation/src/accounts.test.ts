import { describe, expect, it } from "vitest";

import {
  identityDocumentSchema,
  profileUpdateSchema,
  publicSiteUrlSchema,
  signUpSchema,
} from "./index";

describe("account validation", () => {
  it("accepts a valid profile and sign-up payload", () => {
    expect(
      profileUpdateSchema.safeParse({
        displayName: "Gabriel",
        publicZone: "Palermo",
        bio: "Ayudo con tareas del hogar.",
      }).success,
    ).toBe(true);

    expect(
      signUpSchema.safeParse({
        email: "gabriel@example.com",
        password: "correct-horse",
        confirmPassword: "correct-horse",
        displayName: "Gabriel",
      }).success,
    ).toBe(true);
  });

  it("rejects weak passwords and mismatched passwords", () => {
    expect(
      signUpSchema.safeParse({
        email: "gabriel@example.com",
        password: "short",
        confirmPassword: "short",
        displayName: "Gabriel",
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        email: "gabriel@example.com",
        password: "correct-horse",
        confirmPassword: "different-password",
        displayName: "Gabriel",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid identity document MIME types and sizes", () => {
    expect(
      identityDocumentSchema.safeParse({
        documentType: "DNI_FRONT",
        mimeType: "image/svg+xml",
        fileSizeBytes: 512,
      }).success,
    ).toBe(false);

    expect(
      identityDocumentSchema.safeParse({
        documentType: "DNI_FRONT",
        mimeType: "image/png",
        fileSizeBytes: 10 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects non-HTTP site URLs", () => {
    expect(
      publicSiteUrlSchema.safeParse("https://changas.example").success,
    ).toBe(true);
    expect(publicSiteUrlSchema.safeParse("ftp://changas.example").success).toBe(
      false,
    );
  });
});
