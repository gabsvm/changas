import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  signIns: 0,
  failTable: null as string | null,
  failBan: false,
  jobCount: 0 as number | null,
  jobError: false,
  documents: [] as { storage_path: string }[],
  failDocumentRead: false,
  failStorageRemove: false,
  passwordError: false,
  user: {
    id: "user-1",
    email: "a@b.c",
    identities: [{ provider: "email" }],
    app_metadata: { provider: "email", providers: ["email"] },
  } as Record<string, unknown>,
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
        data: { user: mocks.user },
      }),
      signInWithPassword: async () => {
        mocks.signIns += 1;
        return { error: mocks.passwordError ? new Error("bad") : null };
      },
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        or: () => ({
          in: async () => ({
            count: mocks.jobCount,
            error: mocks.jobError ? new Error("jobs unavailable") : null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: async () => {
          mocks.calls.push(`select:${table}`);
          return table === "provider_documents"
            ? {
                data: mocks.documents,
                error: mocks.failDocumentRead ? new Error("boom") : null,
              }
            : { data: [], error: null };
        },
      }),
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
          return {
            error: mocks.failStorageRemove ? new Error("storage unavailable") : null,
          };
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
    mocks.signIns = 0;
    mocks.failTable = null;
    mocks.failBan = false;
    mocks.jobCount = 0;
    mocks.jobError = false;
    mocks.documents = [];
    mocks.failDocumentRead = false;
    mocks.failStorageRemove = false;
    mocks.passwordError = false;
    mocks.user = {
      id: "user-1",
      email: "a@b.c",
      identities: [{ provider: "email" }],
      app_metadata: { provider: "email", providers: ["email"] },
    };
  });

  it("verifies the password for email accounts", async () => {
    await deleteAccount({}, deleteForm()).catch(() => undefined);

    expect(mocks.signIns).toBe(1);
  });

  it("rejects a wrong password for email accounts before touching anything", async () => {
    mocks.passwordError = true;

    const result = await deleteAccount({}, deleteForm());

    expect(result).toEqual({ error: "La contraseña no es correcta." });
    expect(mocks.signIns).toBe(1);
    expect(mocks.calls).toEqual([]);
  });

  it("skips the password for OAuth-only accounts but still requires ELIMINAR", async () => {
    mocks.user = {
      id: "user-1",
      email: "a@b.c",
      identities: [{ provider: "google" }],
      app_metadata: { provider: "google", providers: ["google"] },
    };
    const formData = new FormData();
    formData.set("confirmation", "ELIMINAR");

    const result = await deleteAccount({}, formData).catch(
      (thrown: unknown) => thrown,
    );

    expect(String((result as Error).message)).toBe("redirect:/");
    expect(mocks.signIns).toBe(0);
    expect(mocks.calls[0]).toBe("ban");

    mocks.calls = [];
    const wrong = new FormData();
    wrong.set("confirmation", "eliminar ya");
    expect(await deleteAccount({}, wrong)).toEqual({
      error: 'Escribí "ELIMINAR" para confirmar.',
    });
    expect(mocks.calls).toEqual([]);
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

  it("fails closed when open jobs cannot be verified", async () => {
    mocks.jobError = true;

    const result = await deleteAccount({}, deleteForm());

    expect(result.error).toContain("verificar tus trabajos");
    expect(mocks.calls).toEqual([]);
  });

  it("fails closed when the open-job count is missing", async () => {
    mocks.jobCount = null;

    const result = await deleteAccount({}, deleteForm());

    expect(result.error).toContain("verificar tus trabajos");
    expect(mocks.calls).toEqual([]);
  });

  it("does not ban an account with open jobs", async () => {
    mocks.jobCount = 1;

    const result = await deleteAccount({}, deleteForm());

    expect(result.error).toContain("trabajos en curso");
    expect(mocks.calls).toEqual([]);
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

  it("keeps document metadata available for admin recovery if storage removal fails", async () => {
    mocks.documents = [{ storage_path: "user-1/front.jpg" }];
    mocks.failStorageRemove = true;

    const result = await deleteAccount({}, deleteForm());

    expect(result.error).toContain("algunos datos");
    expect(mocks.calls).toContain("storage:remove");
    expect(mocks.calls).not.toContain("delete:provider_documents");
    expect(mocks.calls).toContain("delete:profile_private");
  });

  it("removes document blobs before deleting their metadata", async () => {
    mocks.documents = [{ storage_path: "user-1/front.jpg" }];

    await deleteAccount({}, deleteForm()).catch(() => undefined);

    expect(mocks.calls.indexOf("storage:remove")).toBeLessThan(
      mocks.calls.indexOf("delete:provider_documents"),
    );
  });

  it("keeps document metadata if reading its storage paths fails", async () => {
    mocks.failDocumentRead = true;

    const result = await deleteAccount({}, deleteForm());

    expect(result.error).toContain("algunos datos");
    expect(mocks.calls).not.toContain("storage:remove");
    expect(mocks.calls).not.toContain("delete:provider_documents");
  });
});
