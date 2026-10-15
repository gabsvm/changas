/**
 * Barrera de seguridad fail-closed para tests destructivos (E2E y concurrencia).
 * Impide terminantemente la ejecucion de scripts o tests destructivos contra
 * entornos remotos, bases productivas o dominios no locales.
 */

const LOCAL_LOOPBACKS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

const FORBIDDEN_DOMAINS = [
  "supabase.co",
  "supabase.in",
  "aws.com",
  "amazonaws.com",
  "digitalocean.com",
  "vercel.app",
  "changas.com",
  "yalo.com",
];

export function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback
  if (ip.startsWith("127.")) return true;
  // RFC 1918 Class A: 10.0.0.0 - 10.255.255.255
  if (ip.startsWith("10.")) return true;
  // RFC 1918 Class B: 172.16.0.0 - 172.31.255.255 (WSL2 / Docker network)
  const bMatch = ip.match(/^172\.(\d+)\./);
  if (bMatch) {
    const octetText = bMatch[1];
    if (octetText !== undefined) {
      const octet = parseInt(octetText, 10);
      if (octet >= 16 && octet <= 31) return true;
    }
  }
  // RFC 1918 Class C: 192.168.0.0 - 192.168.255.255
  if (ip.startsWith("192.168.")) return true;
  // IPv6 Loopback
  if (ip === "::1" || ip === "[::1]") return true;

  return false;
}

export function isLocalOrPrivateHost(hostname: string): boolean {
  const clean = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (LOCAL_LOOPBACKS.has(clean)) return true;
  return isPrivateIp(clean);
}

export function validateLocalSupabaseUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error(
      "SECURITY ERROR: Missing or invalid Supabase URL for local testing.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    throw new Error(`SECURITY ERROR: Malformed Supabase URL: ${err.message}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const forbidden of FORBIDDEN_DOMAINS) {
    if (hostname.includes(forbidden)) {
      throw new Error(
        `SECURITY VIOLATION: Refusing to run destructive tests against remote Supabase target: ${hostname}`,
      );
    }
  }

  if (!isLocalOrPrivateHost(hostname)) {
    throw new Error(
      `SECURITY VIOLATION: Target host "${hostname}" is not a recognized local or private test network host.`,
    );
  }

  if (parsed.protocol === "https:" && !LOCAL_LOOPBACKS.has(hostname)) {
    throw new Error(
      `SECURITY VIOLATION: HTTPS is only permitted for loopback mock proxies, not private IP "${hostname}".`,
    );
  }

  return rawUrl;
}

export function validateLocalDatabaseUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error(
      "SECURITY ERROR: Missing or invalid Database URL for local testing.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    throw new Error(`SECURITY ERROR: Malformed Database URL: ${err.message}`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(
      `SECURITY ERROR: Expected postgres: protocol, received: ${parsed.protocol}`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const forbidden of FORBIDDEN_DOMAINS) {
    if (hostname.includes(forbidden)) {
      throw new Error(
        `SECURITY VIOLATION: Refusing to run destructive tests against remote PostgreSQL target: ${hostname}`,
      );
    }
  }

  if (!isLocalOrPrivateHost(hostname)) {
    throw new Error(
      `SECURITY VIOLATION: Database host "${hostname}" is not a recognized local or private test network host.`,
    );
  }

  const dbName = parsed.pathname.replace(/^\//, "");
  if (dbName !== "postgres" && dbName !== "template1" && dbName !== "") {
    throw new Error(
      `SECURITY VIOLATION: Database name "${dbName}" is not the expected local disposable database ("postgres").`,
    );
  }

  return rawUrl;
}

export function sanitizeConnectionString(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return "[malformed-connection-string]";
  }
}

export async function assertSafeLocalTarget(options: {
  supabaseUrl?: string;
  databaseUrl?: string;
  client?: { query: (sql: string) => Promise<{ rows: any[] }> };
}): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SECURITY VIOLATION: Destructive test runner refused to execute with NODE_ENV=production.",
    );
  }
  if (process.env.VERCEL === "1") {
    throw new Error(
      "SECURITY VIOLATION: Destructive test runner refused to execute inside Vercel environment.",
    );
  }

  if (options.supabaseUrl) {
    validateLocalSupabaseUrl(options.supabaseUrl);
  }

  if (options.databaseUrl) {
    validateLocalDatabaseUrl(options.databaseUrl);
  }

  if (options.client) {
    const res = await options.client.query(
      "SELECT current_database() as db, current_user as usr, inet_server_addr() as srv_ip",
    );
    const row = res.rows[0];
    if (row) {
      if (row.db !== "postgres") {
        throw new Error(
          `SECURITY VIOLATION: Connected to unexpected database "${row.db}". Expected "postgres".`,
        );
      }
      if (row.srv_ip) {
        const ipStr = String(row.srv_ip);
        if (!isPrivateIp(ipStr) && !LOCAL_LOOPBACKS.has(ipStr)) {
          throw new Error(
            `SECURITY VIOLATION: Connected to remote server IP "${ipStr}". Aborting.`,
          );
        }
      }
    }
  }
}
