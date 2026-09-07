export type AuthenticatedNavKey = "home" | "messages" | "activity" | "account";

export function getAuthenticatedNavKey(pathname: string): AuthenticatedNavKey {
  if (pathname === "/account/notifications") return "activity";
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return "messages";
  }
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    return "account";
  }
  return "home";
}
