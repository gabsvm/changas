import { describe, expect, it } from "vitest";

import { classifyAdminAccess, mapAdminRpcError } from "./policy";

describe("Phase 09 admin server policy", () => {
  it("classifies unauthenticated, forbidden and admin sessions", () => {
    expect(classifyAdminAccess(null, false)).toBe("UNAUTHENTICATED");
    expect(classifyAdminAccess("user-id", false)).toBe("FORBIDDEN");
    expect(classifyAdminAccess("admin-id", true)).toBe("ADMIN");
  });

  it("maps database authorization and validation errors to safe admin copy", () => {
    expect(mapAdminRpcError({ code: "42501" }).code).toBe("FORBIDDEN");
    expect(mapAdminRpcError({ code: "P0002" }).code).toBe("NOT_FOUND");
    expect(mapAdminRpcError({ code: "22023" }).code).toBe("CONFLICT");
    expect(mapAdminRpcError({ code: "XX000" }).code).toBe("TRANSIENT");
    expect(mapAdminRpcError({ code: "XX000" }).message).not.toContain("XX000");
  });
});
