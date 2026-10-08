type RateLimiterOptions = {
  /** Máxima cantidad de eventos permitidos por ventana. */
  limit: number;
  /** Duración de la ventana fija en milisegundos. */
  windowMs: number;
  /** Reloj inyectable para tests. */
  now?: () => number;
};

export type RateLimitDecision = {
  allowed: boolean;
  /** Segundos hasta que se libera la ventana (0 si allowed). */
  retryAfterSeconds: number;
};

type WindowState = { windowStart: number; count: number };

/**
 * Rate limiter de ventana fija en memoria, por clave (IP + identidad).
 * Testeable: inyectar `now` en tests. No usar para límites distribuidos
 * (cada instancia lleva su propio conteo); alcanza para frenar abuso
 * barato en auth, webhook, dispatch y oauth/start.
 */
export function createFixedWindowRateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs } = options;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error("Rate limit must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new Error("Rate window must be a positive integer of milliseconds.");
  }
  const now = options.now ?? Date.now;
  const states = new Map<string, WindowState>();

  function check(key: string): RateLimitDecision {
    const timestamp = now();
    const state = states.get(key);
    if (!state || timestamp - state.windowStart >= windowMs) {
      states.set(key, { windowStart: timestamp, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (state.count < limit) {
      state.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.windowStart + windowMs - timestamp) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  function reset(key?: string): void {
    if (key === undefined) states.clear();
    else states.delete(key);
  }

  return { check, reset };
}

/** Limiters compartidos por superficie. Ventanas cortas, límites generosos. */
export const authRateLimiter = createFixedWindowRateLimiter({
  limit: 10,
  windowMs: 60_000,
});

export const webhookRateLimiter = createFixedWindowRateLimiter({
  limit: 60,
  windowMs: 60_000,
});

export const dispatchRateLimiter = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60_000,
});

export const oauthStartRateLimiter = createFixedWindowRateLimiter({
  limit: 20,
  windowMs: 60_000,
});

/** IP del cliente a partir de los headers del proxy/CDN. */
export function getClientIp(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** Clave de límite: ip + identidad (email, data.id, etc.). */
export function rateLimitKey(ip: string, identity: string): string {
  return `${ip}::${identity}`;
}

/**
 * Totales 429 con Retry-After para rutas API.
 */
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { ok: false, error: "rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * CSRF barato para mutaciones sensibles: si el request trae `Origin`,
 * su host tiene que coincidir con el `Host` del request. Los webhooks
 * de Mercado Pago y los callers server-to-server no mandan Origin,
 * así que pasan sin fricción; un browser cross-site no.
 */
export function isAllowedRequestOrigin(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const host = request.headers.get("host")?.toLowerCase();
  if (!host) return false;
  return originHost === host;
}
