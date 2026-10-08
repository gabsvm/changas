import { describe, expect, it } from "vitest";

import {
  createFixedWindowRateLimiter,
  getClientIp,
  isAllowedRequestOrigin,
} from "./rate-limit";

describe("fixed window rate limiter", () => {
  it("permite hasta el límite y después bloquea con retry-after", () => {
    let now = 1_000;
    const limiter = createFixedWindowRateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.check("ip::a")).toMatchObject({ allowed: true });
    expect(limiter.check("ip::a")).toMatchObject({ allowed: true });

    const blocked = limiter.check("ip::a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("aísla el conteo por clave y libera al rotar la ventana", () => {
    let now = 5_000;
    const limiter = createFixedWindowRateLimiter({
      limit: 1,
      windowMs: 10_000,
      now: () => now,
    });

    expect(limiter.check("ip::a").allowed).toBe(true);
    expect(limiter.check("ip::a").allowed).toBe(false);
    expect(limiter.check("ip::b").allowed).toBe(true);

    now += 10_000;
    expect(limiter.check("ip::a")).toMatchObject({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("rechaza configuración inválida", () => {
    expect(() =>
      createFixedWindowRateLimiter({ limit: 0, windowMs: 1000 }),
    ).toThrow();
    expect(() =>
      createFixedWindowRateLimiter({ limit: 5, windowMs: -1 }),
    ).toThrow();
  });
});

describe("client ip y origen", () => {
  it("prefiere el primer x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      "x-real-ip": "9.9.9.9",
    });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("acepta requests sin Origin y rechaza cross-site", () => {
    const stub = (entries: Record<string, string>) => ({
      headers: {
        get: (name: string) => entries[name.toLowerCase()] ?? null,
      },
    });
    expect(
      isAllowedRequestOrigin(
        stub({ host: "changas.test", origin: "https://changas.test" }),
      ),
    ).toBe(true);

    expect(
      isAllowedRequestOrigin(
        stub({ host: "changas.test", origin: "https://evil.test" }),
      ),
    ).toBe(false);

    expect(isAllowedRequestOrigin(stub({ host: "changas.test" }))).toBe(true);
  });
});
