import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, getClaims, getUser } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "./proxy";

describe("updateSession", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-publishable-key";
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    createServerClient.mockReturnValue({
      auth: { getClaims, getUser },
    });
  });

  it("refreshes claims with getClaims and not getUser", async () => {
    await updateSession(new NextRequest("http://localhost:3000/login"));

    expect(getClaims).toHaveBeenCalledOnce();
    expect(getUser).not.toHaveBeenCalled();
  });
});
