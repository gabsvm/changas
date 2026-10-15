import { describe, expect, it } from "vitest";
import {
  assertSafeLocalTarget,
  isLocalOrPrivateHost,
  isPrivateIp,
  sanitizeConnectionString,
  validateLocalDatabaseUrl,
  validateLocalSupabaseUrl,
} from "./test-safety-guard";

describe("test-safety-guard", () => {
  describe("IP and host validation", () => {
    it("recognizes loopback addresses", () => {
      expect(isLocalOrPrivateHost("localhost")).toBe(true);
      expect(isLocalOrPrivateHost("127.0.0.1")).toBe(true);
      expect(isLocalOrPrivateHost("::1")).toBe(true);
      expect(isLocalOrPrivateHost("[::1]")).toBe(true);
    });

    it("recognizes private subnets (WSL2, Docker, LAN)", () => {
      expect(isPrivateIp("172.26.154.92")).toBe(true);
      expect(isPrivateIp("172.17.0.1")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("192.168.1.50")).toBe(true);
      expect(isLocalOrPrivateHost("172.26.154.92")).toBe(true);
    });

    it("rejects public IPs", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("104.18.25.10")).toBe(false);
      expect(isPrivateIp("172.35.0.1")).toBe(false); // fuera de 172.16 - 172.31
      expect(isLocalOrPrivateHost("8.8.8.8")).toBe(false);
    });
  });

  describe("validateLocalSupabaseUrl", () => {
    it("accepts valid local loopback and WSL2 IPs", () => {
      expect(validateLocalSupabaseUrl("http://localhost:54321")).toBe(
        "http://localhost:54321",
      );
      expect(validateLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(
        "http://127.0.0.1:54321",
      );
      expect(validateLocalSupabaseUrl("http://172.26.154.92:54321")).toBe(
        "http://172.26.154.92:54321",
      );
    });

    it("rejects supabase.co and cloud providers", () => {
      expect(() =>
        validateLocalSupabaseUrl("https://abcdef.supabase.co"),
      ).toThrow(
        /Refusing to run destructive tests against remote Supabase target/,
      );
      expect(() =>
        validateLocalSupabaseUrl("http://external-untrusted-server.org:54321"),
      ).toThrow(
        /Target host.*is not a recognized local or private test network/,
      );
    });

    it("rejects non-loopback HTTPS", () => {
      expect(() =>
        validateLocalSupabaseUrl("https://172.26.154.92:54321"),
      ).toThrow(/HTTPS is only permitted for loopback mock proxies/);
    });
  });

  describe("validateLocalDatabaseUrl", () => {
    it("accepts local postgres connection strings", () => {
      expect(
        validateLocalDatabaseUrl(
          "postgres://postgres:postgres@127.0.0.1:54322/postgres",
        ),
      ).toBe("postgres://postgres:postgres@127.0.0.1:54322/postgres");
      expect(
        validateLocalDatabaseUrl(
          "postgresql://postgres:secret@localhost:54322/postgres",
        ),
      ).toBe("postgresql://postgres:secret@localhost:54322/postgres");
      expect(
        validateLocalDatabaseUrl(
          "postgres://postgres:pass@172.26.154.92:54322/postgres",
        ),
      ).toBe("postgres://postgres:pass@172.26.154.92:54322/postgres");
    });

    it("rejects remote or cloud postgres targets", () => {
      expect(() =>
        validateLocalDatabaseUrl(
          "postgres://postgres:secret@db.abcdef.supabase.co:5432/postgres",
        ),
      ).toThrow(
        /Refusing to run destructive tests against remote PostgreSQL target/,
      );
      expect(() =>
        validateLocalDatabaseUrl(
          "postgres://postgres:secret@db.external.host.com:5432/postgres",
        ),
      ).toThrow(/not a recognized local or private test network/);
    });

    it("rejects non-postgres database names", () => {
      expect(() =>
        validateLocalDatabaseUrl(
          "postgres://postgres:secret@127.0.0.1:54322/production_changas",
        ),
      ).toThrow(/not the expected local disposable database/);
    });
  });

  describe("sanitizeConnectionString", () => {
    it("masks password credentials from connection strings", () => {
      const sanitized = sanitizeConnectionString(
        "postgres://postgres:super_secret_password_123@127.0.0.1:54322/postgres",
      );
      expect(sanitized).toBe(
        "postgres://postgres:***@127.0.0.1:54322/postgres",
      );
      expect(sanitized).not.toContain("super_secret_password_123");
    });
  });

  describe("assertSafeLocalTarget", () => {
    it("rejects when NODE_ENV is production", async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        await expect(assertSafeLocalTarget({})).rejects.toThrow(
          /NODE_ENV=production/,
        );
      } finally {
        process.env.NODE_ENV = orig;
      }
    });

    it("rejects when VERCEL is 1", async () => {
      const orig = process.env.VERCEL;
      process.env.VERCEL = "1";
      try {
        await expect(assertSafeLocalTarget({})).rejects.toThrow(
          /inside Vercel environment/,
        );
      } finally {
        process.env.VERCEL = orig;
      }
    });

    it("verifies live postgres client metadata against expected values", async () => {
      const mockSafeClient = {
        query: async () => ({
          rows: [{ db: "postgres", usr: "postgres", srv_ip: "127.0.0.1" }],
        }),
      };
      await expect(
        assertSafeLocalTarget({ client: mockSafeClient as any }),
      ).resolves.toBeUndefined();

      const mockUnsafeDbClient = {
        query: async () => ({
          rows: [{ db: "prod_db", usr: "postgres", srv_ip: "127.0.0.1" }],
        }),
      };
      await expect(
        assertSafeLocalTarget({ client: mockUnsafeDbClient as any }),
      ).rejects.toThrow(/Connected to unexpected database "prod_db"/);

      const mockUnsafeIpClient = {
        query: async () => ({
          rows: [{ db: "postgres", usr: "postgres", srv_ip: "54.23.12.9" }],
        }),
      };
      await expect(
        assertSafeLocalTarget({ client: mockUnsafeIpClient as any }),
      ).rejects.toThrow(/Connected to remote server IP/);
    });
  });
});
