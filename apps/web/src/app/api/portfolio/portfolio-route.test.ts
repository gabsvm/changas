import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, download, maybeSingle } = vi.hoisted(
  () => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    download: vi.fn(),
    maybeSingle: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { GET } from "./[...path]/route";

describe("portfolio media route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const projectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(projectionQuery),
    });
    createAdminClient.mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({ download }),
      },
    });
  });

  it("downloads only an exact public projection row and caches it publicly", async () => {
    const path = "owner-id/public.png";
    maybeSingle.mockResolvedValue({
      data: { media_path: path, media_mime_type: "image/png" },
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob(["synthetic image"], { type: "image/png" }),
      error: null,
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: path.split("/") }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("synthetic image");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=300",
    );
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(download).toHaveBeenCalledWith(path);
  });

  it("returns 404 before Storage when the path is absent from the public projection", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ path: ["owner-id", "private.png"] }),
    });

    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});
