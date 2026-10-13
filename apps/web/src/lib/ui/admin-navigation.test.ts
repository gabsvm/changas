import { describe, expect, it } from "vitest";

import {
  adminMoreItems,
  adminPrimaryMobileItems,
  isAdminNavigationItemActive,
} from "./admin-navigation";

describe("admin navigation", () => {
  it("keeps the mobile bar focused on the three highest-frequency destinations", () => {
    expect(adminPrimaryMobileItems.map((item) => item.label)).toEqual([
      "Resumen",
      "Identidad",
      "Usuarios",
    ]);
    expect(adminMoreItems.map((item) => item.label)).toEqual([
      "Trabajos",
      "Reportes",
      "Pagos",
      "Prestadores",
      "Catálogo",
      "Auditoría",
    ]);
  });

  it("groups secondary destinations by workflow", () => {
    expect(adminMoreItems.map((item) => item.navGroup)).toEqual([
      "Operación",
      "Operación",
      "Operación",
      "Personas",
      "Catálogo",
      "Sistema",
    ]);
  });

  it("marks exact overview and nested admin sections correctly", () => {
    expect(isAdminNavigationItemActive("/admin", "/admin")).toBe(true);
    expect(isAdminNavigationItemActive("/admin/users", "/admin")).toBe(false);
    expect(
      isAdminNavigationItemActive("/admin/users/abc", "/admin/users"),
    ).toBe(true);
  });
});
