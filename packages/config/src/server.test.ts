import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getServiceRoleEnv } from "./server";

const URL = "https://test.supabase.co";
const PRIMARY = "test-supabase-service-role-key";
const LEGACY = "test-legacy-service-role-key";

describe("getServiceRoleEnv service-role fallback", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved.NEXT_PUBLIC_SUPABASE_URL;
    if (saved.SUPABASE_SERVICE_ROLE_KEY !== undefined) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = saved.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    if (saved.SERVICE_ROLE_KEY !== undefined) {
      process.env.SERVICE_ROLE_KEY = saved.SERVICE_ROLE_KEY;
    } else {
      delete process.env.SERVICE_ROLE_KEY;
    }
  });

  it("prefers SUPABASE_SERVICE_ROLE_KEY when both keys are set", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = PRIMARY;
    process.env.SERVICE_ROLE_KEY = LEGACY;
    expect(getServiceRoleEnv()).toEqual({
      url: URL,
      serviceRoleKey: PRIMARY,
    });
  });

  it("falls back to SERVICE_ROLE_KEY so existing deployments keep working", () => {
    process.env.SERVICE_ROLE_KEY = LEGACY;
    expect(getServiceRoleEnv()).toEqual({
      url: URL,
      serviceRoleKey: LEGACY,
    });
  });

  it("throws an actionable error when no service-role key is set", () => {
    expect(() => getServiceRoleEnv()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("throws when the Supabase URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = PRIMARY;
    expect(() => getServiceRoleEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});
