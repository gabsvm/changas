import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const shell = readFileSync(
  new URL("../../components/ui/consumer-shell.tsx", import.meta.url),
  "utf8",
);

const marketplacePages = [
  "../../app/page.tsx",
  "../../app/buscar/page.tsx",
  "../../app/categoria/[slug]/page.tsx",
  "../../app/p/[slug]/page.tsx",
  "../../app/p/[slug]/[serviceSlug]/page.tsx",
].map((path) => ({
  path,
  source: readFileSync(new URL(path, import.meta.url), "utf8"),
}));

describe("ConsumerShell", () => {
  it("keeps authenticated marketplace navigation inside one shared shell", () => {
    expect(shell).toContain("AuthenticatedBottomNav");
    expect(shell).toContain("getUnreadNotificationCount");
    expect(shell).toContain('href="/account"');
    expect(shell).toContain('href="/login"');
  });

  it("is used by every primary public marketplace route", () => {
    for (const page of marketplacePages) {
      expect(page.source, page.path).toContain("ConsumerShell");
    }
  });
});
