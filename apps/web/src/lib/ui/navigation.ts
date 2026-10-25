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
  // Las necesidades viven en el carril de trabajos: nunca resaltan "home".
  if (pathname === "/needs" || pathname.startsWith("/needs/")) return "jobs";
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return "messages";
  }
  // Oportunidades no tiene tab propia en la bottom nav de 5: cae en cuenta.
  if (pathname === "/oportunidades" || pathname.startsWith("/oportunidades/")) {
    return "account";
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
