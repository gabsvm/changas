import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const OAUTH_STATE_TTL_MS = 10 * 60_000;
const MAX_FUTURE_SKEW_MS = 60_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OAuthStateInput = {
  providerUserId: string;
  returnPath: string;
};

export type VerifiedOAuthState = OAuthStateInput & {
  issuedAt: number;
  expiresAt: number;
};

type OAuthStatePayload = VerifiedOAuthState & {
  version: 1;
  nonce: string;
};

function decodeSigningSecret(secret: string): Buffer {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      secret,
    )
  ) {
    throw new Error("OAuth state signing secret must be canonical base64.");
  }

  const decoded = Buffer.from(secret, "base64");
  if (decoded.toString("base64") !== secret || decoded.length < 32) {
    throw new Error(
      "OAuth state signing secret must decode to at least 32 bytes.",
    );
  }
  return decoded;
}

function assertProviderUserId(providerUserId: string): void {
  if (!UUID_PATTERN.test(providerUserId)) {
    throw new Error("OAuth state provider user ID must be a UUID.");
  }
}

function assertSafeReturnPath(returnPath: string): void {
  if (
    returnPath.length === 0 ||
    !returnPath.startsWith("/") ||
    returnPath.startsWith("//") ||
    returnPath.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(returnPath)
  ) {
    throw new Error(
      "OAuth state return path must be a safe local application path.",
    );
  }
}

function sign(encodedPayload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

export function createOAuthState(
  input: OAuthStateInput,
  secret: string,
  now = Date.now(),
): string {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > Number.MAX_SAFE_INTEGER - OAUTH_STATE_TTL_MS
  ) {
    throw new Error("OAuth state issuance time must be a valid safe integer.");
  }
  assertProviderUserId(input.providerUserId);
  assertSafeReturnPath(input.returnPath);
  const secretBytes = decodeSigningSecret(secret);

  const payload: OAuthStatePayload = {
    version: 1,
    providerUserId: input.providerUserId,
    returnPath: input.returnPath,
    issuedAt: now,
    expiresAt: now + OAUTH_STATE_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = sign(encodedPayload, secretBytes).toString("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(
  state: string,
  secret: string,
  now = Date.now(),
): VerifiedOAuthState {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error(
      "OAuth state verification time must be a non-negative safe integer.",
    );
  }
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("OAuth state is malformed.");
  }

  const [encodedPayload, encodedSignature] = parts;
  if (
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSignature)
  ) {
    throw new Error("OAuth state is malformed.");
  }

  const secretBytes = decodeSigningSecret(secret);
  const expectedSignature = sign(encodedPayload, secretBytes);
  const actualSignature = Buffer.from(encodedSignature, "base64url");
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error("OAuth state signature is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    throw new Error("OAuth state payload is invalid.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("OAuth state payload is invalid.");
  }
  const payload = parsed as Record<string, unknown>;
  if (
    payload.version !== 1 ||
    typeof payload.providerUserId !== "string" ||
    typeof payload.returnPath !== "string" ||
    typeof payload.issuedAt !== "number" ||
    !Number.isSafeInteger(payload.issuedAt) ||
    typeof payload.expiresAt !== "number" ||
    !Number.isSafeInteger(payload.expiresAt) ||
    typeof payload.nonce !== "string" ||
    payload.nonce.length === 0
  ) {
    throw new Error("OAuth state payload is invalid.");
  }

  assertProviderUserId(payload.providerUserId);
  assertSafeReturnPath(payload.returnPath);

  if (payload.expiresAt !== payload.issuedAt + OAUTH_STATE_TTL_MS) {
    throw new Error("OAuth state expiry is invalid.");
  }
  if (now > payload.expiresAt) {
    throw new Error("OAuth state has expired.");
  }
  if (payload.issuedAt - now > MAX_FUTURE_SKEW_MS) {
    throw new Error("OAuth state issuance time is in the future.");
  }

  return {
    providerUserId: payload.providerUserId,
    returnPath: payload.returnPath,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}
