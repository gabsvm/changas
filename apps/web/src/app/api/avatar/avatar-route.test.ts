import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, download, maybeSingle } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  download: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { GET } from "./[...path]/route";

describe("private avatar delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
      storage: { from: vi.fn().mockReturnValue({ download }) },
    });
  });

  it("rejects malformed paths", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "nested", "avatar.jpg"] }),
    });
    expect(response.status).toBe(404);
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("does not proxy an unassociated object", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "avatar.jpg"] }),
    });
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("serves only the currently associated object with safe headers", async () => {
    maybeSingle.mockResolvedValue({
      data: { avatar_url: "/api/avatar/owner/avatar.jpg" },
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob(["avatar"], { type: "image/jpeg" }),
      error: null,
    });
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "avatar.jpg"] }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("avatar");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(download).toHaveBeenCalledWith("owner/avatar.jpg");
  });

  it("serves the current avatar to public requests without a session", async () => {
    maybeSingle.mockResolvedValue({
      data: { avatar_url: "/api/avatar/owner/avatar.jpg" },
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob(["avatar"], { type: "image/jpeg" }),
      error: null,
    });
    // No cookies, Authorization header, or session: access control rests
    // on the profile association, not on who is asking.
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "avatar.jpg"] }),
    });
    expect(response.status).toBe(200);
    expect(download).toHaveBeenCalledWith("owner/avatar.jpg");
  });

  it("returns 404 when the visitor requests a stale (no longer associated) object", async () => {
    // The route queries profiles by exact avatar_url match, so a rotated-out
    // path matches no row and never reaches storage.
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "old-avatar.jpg"] }),
    });
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("returns 404 for profiles without an avatar", async () => {
    maybeSingle.mockResolvedValue({
      data: { avatar_url: null },
      error: null,
    });
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "avatar.jpg"] }),
    });
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("hides profile lookup failures behind a generic 404", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "secret" },
    });
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "avatar.jpg"] }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No encontramos esa imagen.",
    });
    expect(download).not.toHaveBeenCalled();
  });

  it("hides storage failures", async () => {
    maybeSingle.mockResolvedValue({
      data: { avatar_url: "/api/avatar/owner/avatar.jpg" },
      error: null,
    });
    download.mockResolvedValue({ data: null, error: { message: "secret" } });
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner", "avatar.jpg"] }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No encontramos esa imagen.",
    });
  });
});
