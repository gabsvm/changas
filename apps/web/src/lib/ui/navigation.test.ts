import { describe, expect, it } from "vitest";

import { getAuthenticatedNavKey } from "./navigation";

describe("getAuthenticatedNavKey", () => {
  it.each([
    ["/", "home"],
    ["/buscar", "home"],
    ["/categoria/electricidad", "home"],
    ["/p/alguien", "home"],
    ["/p/alguien/servicio", "home"],
    ["/messages", "messages"],
    ["/messages/123", "messages"],
    ["/activity", "activity"],
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
