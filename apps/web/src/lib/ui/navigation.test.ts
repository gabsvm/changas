import { describe, expect, it } from "vitest";

import { getAuthenticatedNavKey } from "./navigation";

describe("getAuthenticatedNavKey", () => {
  it.each([
    ["/", "home"],
    ["/buscar", "home"],
    ["/categoria/electricidad", "home"],
    ["/messages", "messages"],
    ["/messages/123", "messages"],
    ["/account/notifications", "activity"],
    ["/account", "account"],
    ["/account/profile", "account"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(getAuthenticatedNavKey(pathname)).toBe(expected);
  });
});
