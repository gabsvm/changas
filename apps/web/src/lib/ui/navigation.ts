export type AuthenticatedNavKey = "home" | "messages" | "activity" | "account";

export function getAuthenticatedNavKey(pathname: string): AuthenticatedNavKey {
  if (
    pathname === "/activity" ||
    pathname === "/account/notifications" ||
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/")
  ) {
    return "activity";
  }
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return "messages";
  }
  if (
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/provider" ||
    pathname.startsWith("/provider/")
  ) {
    return "account";
  }
  return "home";
}
