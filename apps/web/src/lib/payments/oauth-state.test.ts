import { describe, expect, it } from "vitest";

import { createOAuthState, verifyOAuthState } from "./oauth-state";

const SECRET = Buffer.alloc(32, 21).toString("base64");
const OTHER_SECRET = Buffer.alloc(32, 22).toString("base64");
const NOW = Date.UTC(2026, 8, 5, 16, 0, 0);

describe("Phase 11 Mercado Pago OAuth state", () => {
  it("round-trips a signed provider-bound local return path", () => {
    const state = createOAuthState(
      {
        providerUserId: "11111111-1111-4111-8111-111111111111",
        returnPath: "/provider/manage?payment=connected",
      },
      SECRET,
      NOW,
    );

    expect(verifyOAuthState(state, SECRET, NOW + 1_000)).toMatchObject({
      providerUserId: "11111111-1111-4111-8111-111111111111",
      returnPath: "/provider/manage?payment=connected",
    });
  });

  it("produces unique state values for identical inputs", () => {
    const input = {
      providerUserId: "11111111-1111-4111-8111-111111111111",
      returnPath: "/provider/manage",
    };

    expect(createOAuthState(input, SECRET, NOW)).not.toBe(
      createOAuthState(input, SECRET, NOW),
    );
  });

  it("rejects tampering and a different signing secret", () => {
    const state = createOAuthState(
      {
        providerUserId: "11111111-1111-4111-8111-111111111111",
        returnPath: "/provider/manage",
      },
      SECRET,
      NOW,
    );
    const [payload, signature] = state.split(".");
    const tamperedPayload = `${payload?.slice(0, -1)}A.${signature}`;

    expect(() => verifyOAuthState(tamperedPayload, SECRET, NOW + 1_000)).toThrow();
    expect(() => verifyOAuthState(state, OTHER_SECRET, NOW + 1_000)).toThrow();
  });

  it("rejects expired and future-issued state", () => {
    const state = createOAuthState(
      {
        providerUserId: "11111111-1111-4111-8111-111111111111",
        returnPath: "/provider/manage",
      },
      SECRET,
      NOW,
    );

    expect(() => verifyOAuthState(state, SECRET, NOW + 10 * 60_000 + 1)).toThrow();
    expect(() => verifyOAuthState(state, SECRET, NOW - 60_001)).toThrow();
  });

  it.each([
    "https://evil.example/callback",
    "//evil.example/callback",
    "javascript:alert(1)",
    "/\\evil.example",
    "",
  ])("rejects unsafe return path %s", (returnPath) => {
    expect(() =>
      createOAuthState(
        {
          providerUserId: "11111111-1111-4111-8111-111111111111",
          returnPath,
        },
        SECRET,
        NOW,
      ),
    ).toThrow();
  });

  it("rejects malformed provider IDs and weak signing secrets", () => {
    expect(() =>
      createOAuthState(
        { providerUserId: "not-a-uuid", returnPath: "/provider/manage" },
        SECRET,
        NOW,
      ),
    ).toThrow();
    expect(() =>
      createOAuthState(
        {
          providerUserId: "11111111-1111-4111-8111-111111111111",
          returnPath: "/provider/manage",
        },
        Buffer.alloc(31).toString("base64"),
        NOW,
      ),
    ).toThrow();
  });
});
