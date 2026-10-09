import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  failTable: null as string | null,
  failBan: false,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "a@b.c" } },
      }),
      signInWithPassword: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        or: () => ({ in: async () => ({ count: 0 }) }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: async () => ({ data: [] }) }),
      update: () => ({
        eq: async () => {
          mocks.calls.push(`update:${table}`);
          return mocks.failTable === table
            ? { error: new Error("boom") }
            : { error: null };
        },
      }),
      delete: () => ({
        eq: async () => {
          mocks.calls.push(`delete:${table}`);
          return mocks.failTable === table
            ? { error: new Error("boom") }
            : { error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        remove: async () => {
          mocks.calls.push("storage:remove");
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        updateUserById: async () => {
          mocks.calls.push("ban");
          return mocks.failBan ? { error: new Error("boom") } : { error: null };
        },
        signOut: async () => {
          mocks.calls.push("revoke");
          return { error: null };
        },
      },
    },
  }),
}));

import { deleteAccount } from "./actions";

function deleteForm(): FormData {
  const formData = new FormData();
  formData.set("password", "secret-123");
  formData.set("confirmation", "ELIMINAR");
  return formData;
}

describe("deleteAccount", () => {
  afterEach(() => {
    mocks.calls = [];
    mocks.failTable = null;
    mocks.failBan = false;
  });

  it("bans before wiping so a ban failure destroys nothing", async () => {
    const result = await deleteAccount({}, deleteForm()).catch(
      (thrown: unknown) => thrown,
    );

    expect(String((result as Error).message)).toBe("redirect:/");
    expect(mocks.calls[0]).toBe("ban");
    expect(mocks.calls).toContain("update:profiles");
    expect(mocks.calls).toContain("delete:profile_private");
  });

  it("retries cleanly when the ban fails", async () => {
    mocks.failBan = true;

    const result = await deleteAccount({}, deleteForm());

    expect(result).toEqual({
      error: "No pudimos eliminar la cuenta. Intentá de nuevo.",
    });
    expect(mocks.calls).toEqual(["ban"]);
  });

  it("collects wipe failures without stranding the other steps", async () => {
    mocks.failTable = "profile_private";

    const result = await deleteAccount({}, deleteForm());

    expect(result.error ?? "").toContain("Tu acceso fue eliminado");
    // Every other wipe still ran despite the failure.
    expect(mocks.calls).toContain("update:profiles");
    expect(mocks.calls).toContain("delete:push_subscriptions");
    expect(mocks.calls).toContain("delete:provider_documents");
    expect(mocks.calls).toContain("update:services");
    expect(mocks.calls).toContain("update:provider_profiles");
  });
});
