export type AdminNavigationId =
  | "overview"
  | "identity"
  | "users"
  | "providers"
  | "catalog"
  | "reports"
  | "jobs"
  | "payments"
  | "audit";

export type AdminNavigationItem = {
  id: AdminNavigationId;
  href: string;
  label: string;
  mobileGroup: "primary" | "more";
};

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  { id: "overview", href: "/admin", label: "Resumen", mobileGroup: "primary" },
  { id: "identity", href: "/admin/identity", label: "Identidad", mobileGroup: "primary" },
  { id: "users", href: "/admin/users", label: "Usuarios", mobileGroup: "primary" },
  { id: "providers", href: "/admin/providers", label: "Prestadores", mobileGroup: "more" },
  { id: "catalog", href: "/admin/catalog", label: "Catálogo", mobileGroup: "more" },
  { id: "reports", href: "/admin/reports", label: "Reportes", mobileGroup: "more" },
  { id: "jobs", href: "/admin/jobs", label: "Trabajos", mobileGroup: "more" },
  { id: "payments", href: "/admin/payments", label: "Pagos", mobileGroup: "more" },
  { id: "audit", href: "/admin/audit", label: "Auditoría", mobileGroup: "more" },
] as const;

export const adminPrimaryMobileItems = adminNavigationItems.filter(
  (item) => item.mobileGroup === "primary",
);

export const adminMoreItems = adminNavigationItems.filter(
  (item) => item.mobileGroup === "more",
);

export function isAdminNavigationItemActive(
  pathname: string,
  href: string,
): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
