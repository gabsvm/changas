import { describe, expect, it } from "vitest";

import { getAuthenticatedNavKey } from "./navigation";

describe("getAuthenticatedNavKey", () => {
  it.each([
    ["/", "home"],
    ["/buscar", "search"],
    ["/categoria/electricidad", "search"],
    ["/messages", "messages"],
    ["/messages/123", "messages"],
    ["/account/notifications", "activity"],
    ["/jobs", "activity"],
    ["/jobs/123", "activity"],
    ["/account", "account"],
    ["/account/profile", "account"],
    ["/provider/onboarding", "account"],
    ["/provider/onboarding/documents", "account"],
    ["/provider/manage", "account"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(getAuthenticatedNavKey(pathname)).toBe(expected);
  });
});
