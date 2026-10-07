export type AuthenticatedNavKey =
  "home" | "search" | "jobs" | "messages" | "account";

export function getAuthenticatedNavKey(pathname: string): AuthenticatedNavKey {
  if (
    pathname === "/buscar" ||
    pathname.startsWith("/buscar/") ||
    pathname === "/categoria" ||
    pathname.startsWith("/categoria/")
  ) {
    return "search";
  }
  if (
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/") ||
    pathname.startsWith("/account/jobs")
  )
    return "jobs";
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
