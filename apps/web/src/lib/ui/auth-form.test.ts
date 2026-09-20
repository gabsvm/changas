import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const authForm = readFileSync(
  new URL("../../components/auth/auth-form.tsx", import.meta.url),
  "utf8",
);

describe("auth form mobile contract", () => {
  it("keeps a compact sheet on mobile and the editorial card on desktop", () => {
    expect(authForm).toContain("rounded-[1.25rem]");
    expect(authForm).toContain("sm:rounded-[2rem]");
    expect(authForm).toContain("text-3xl");
    expect(authForm).toContain("sm:text-4xl");
    expect(authForm).toContain("sm:p-8");
    expect(authForm).toContain("sm:shadow-");
  });

  it("separates the Google action with an explicit divider", () => {
    expect(authForm).toContain("Continuar con Google");
    expect(authForm).toContain("<span>o</span>");
  });
});
