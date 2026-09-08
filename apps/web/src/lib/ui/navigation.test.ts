import { describe, expect, it } from "vitest";

import {
  getAuthenticatedNavKey,
  shouldShowAuthenticatedBottomNav,
} from "./navigation";

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

describe("shouldShowAuthenticatedBottomNav", () => {
  it("keeps primary message navigation but hides it inside a conversation", () => {
    expect(shouldShowAuthenticatedBottomNav("/messages")).toBe(true);
    expect(shouldShowAuthenticatedBottomNav("/messages/abc")).toBe(false);
  });

  it("keeps bottom navigation on normal authenticated surfaces", () => {
    expect(shouldShowAuthenticatedBottomNav("/activity")).toBe(true);
    expect(shouldShowAuthenticatedBottomNav("/jobs/abc")).toBe(true);
    expect(shouldShowAuthenticatedBottomNav("/account")).toBe(true);
  });
});
