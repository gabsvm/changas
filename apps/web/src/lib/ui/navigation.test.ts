import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getAuthenticatedNavKey } from "./navigation";

describe("getAuthenticatedNavKey", () => {
  it.each([
    ["/", "home"],
    ["/buscar", "search"],
    ["/categoria/electricidad", "search"],
    ["/messages", "messages"],
    ["/messages/123", "messages"],
    ["/account/notifications", "account"],
    ["/jobs", "jobs"],
    ["/jobs/123", "jobs"],
    ["/needs", "jobs"],
    ["/needs/new", "jobs"],
    ["/needs/abc", "jobs"],
    ["/oportunidades", "account"],
    ["/oportunidades/", "account"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(getAuthenticatedNavKey(pathname)).toBe(expected);
  });
});

describe("authenticated bottom nav icons", () => {
  it("uses a briefcase for jobs so it never looks like the activity bell", () => {
    const source = readFileSync(
      new URL(
        "../../components/ui/authenticated-bottom-nav.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain('"briefcase"');
    expect(source).not.toContain('href: "/jobs", icon: "activity"');
  });
});
