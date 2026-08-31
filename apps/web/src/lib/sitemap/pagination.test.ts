import { describe, expect, it } from "vitest";

import { collectPaginated, splitSitemapUrls } from "./pagination";

describe("sitemap pagination", () => {
  it("assembles every range page beyond a Data API page", async () => {
    const source = [1, 2, 3, 4, 5];
    const result = await collectPaginated(
      async (from, to) => source.slice(from, to + 1),
      2,
    );
    expect(result).toEqual(source);
  });

  it("splits output at the sitemap protocol limit", () => {
    expect(
      splitSitemapUrls(Array.from({ length: 50_001 })).map((x) => x.length),
    ).toEqual([50_000, 1]);
  });
});
