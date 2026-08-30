import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, getClaims, getSession, getUser } = vi.hoisted(
  () => ({
    createServerClient: vi.fn(),
    getClaims: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
  }),
);

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "./proxy";

type CookieToSet = {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    path: string;
  };
};

type ServerClientOptions = {
  cookies: {
    setAll: (
      cookiesToSet: CookieToSet[],
      headers: Record<string, string>,
    ) => void;
  };
};

describe("updateSession", () => {
  let serverClientOptions: ServerClientOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-publishable-key";
    const cookiesToSet: CookieToSet[] = [
      {
        name: "sb-changas-auth-token",
        value: "refreshed-token",
        options: { httpOnly: true, path: "/" },
      },
    ];
    const headers = {
      "Cache-Control":
        "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    };
    getClaims.mockImplementation(async () => {
      serverClientOptions.cookies.setAll(cookiesToSet, headers);
      return { data: { claims: null }, error: null };
    });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    createServerClient.mockImplementation(
      (_url: string, _key: string, options: ServerClientOptions) => {
        serverClientOptions = options;
        return {
          auth: { getClaims, getSession, getUser },
        };
      },
    );
  });

  it("forwards refreshed cookies and cache headers from setAll", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3000/login"),
    );

    expect(response.cookies.get("sb-changas-auth-token")?.value).toBe(
      "refreshed-token",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });

  it("refreshes claims with getClaims and not getUser", async () => {
    await updateSession(new NextRequest("http://localhost:3000/login"));

    expect(getClaims).toHaveBeenCalledOnce();
    expect(getUser).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });
});
