export type AuthenticatedNavKey =
  | "home"
  | "search"
  | "messages"
  | "activity"
  | "account";

export function getAuthenticatedNavKey(pathname: string): AuthenticatedNavKey {
  if (
    pathname === "/buscar" ||
    pathname.startsWith("/buscar/") ||
    pathname === "/categoria" ||
    pathname.startsWith("/categoria/")
  ) {
    return "search";
  }
  if (pathname === "/account/notifications") return "activity";
  if (
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/") ||
    pathname.startsWith("/account/jobs")
  )
    return "activity";
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
