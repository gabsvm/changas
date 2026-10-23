import { afterEach, describe, expect, it, vi } from "vitest";

import {
  filterPublicSkillsByCategoryId,
  isExcludedPublicTestCategory,
} from "./public-catalog";
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public test category exclusion", () => {
  it("excludes emulator test categories only in production", () => {
    const slugCategory = { slug: "prueba-emulador", name: "Other" };
    const namedCategory = { slug: "misc", name: "Prueba emulador" };
    const legitimateCategory = { slug: "musica", name: "Prueba de música" };

    vi.stubEnv("NODE_ENV", "production");
    expect(isExcludedPublicTestCategory(slugCategory)).toBe(true);
    expect(isExcludedPublicTestCategory(namedCategory)).toBe(true);
    expect(isExcludedPublicTestCategory(legitimateCategory)).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    expect(isExcludedPublicTestCategory(slugCategory)).toBe(false);
    expect(isExcludedPublicTestCategory(namedCategory)).toBe(false);
    expect(isExcludedPublicTestCategory(legitimateCategory)).toBe(false);
  });

  it("handles absent and null category names safely", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isExcludedPublicTestCategory({ slug: "misc" })).toBe(false);
    expect(isExcludedPublicTestCategory({ slug: "misc", name: null })).toBe(
      false,
    );
  });

  it("filters skills by excluded category ID without filtering legitimate names", () => {
    const skills = [
      { category_id: "excluded", name: "Jardineria" },
      { category_id: "legitimate", name: "Testing musical instruments" },
    ];

    expect(
      filterPublicSkillsByCategoryId(skills, new Set(["excluded"])),
    ).toEqual([skills[1]]);
  });
});
