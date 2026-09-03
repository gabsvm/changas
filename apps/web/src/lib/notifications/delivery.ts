import {
  createPrivateKey,
  sign,
  timingSafeEqual,
} from "node:crypto";

import type { DeliveryResult, TransactionalEmail } from "./types";

const VAPID_TTL_SECONDS = 12 * 60 * 60;

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseVapidPublicKey(publicKey: string): { x: string; y: string } {
  const bytes = Buffer.from(publicKey, "base64url");

  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error("VAPID public key must be an uncompressed P-256 point.");
  }

  return {
    x: bytes.subarray(1, 33).toString("base64url"),
    y: bytes.subarray(33, 65).toString("base64url"),
  };
}

export function buildVapidAuthorization({
  endpoint,
  publicKey,
  privateKey,
  subject,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  endpoint: string;
  publicKey: string;
  privateKey: string;
  subject: string;
  nowSeconds?: number;
}): string {
  const pushOrigin = new URL(endpoint).origin;
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    throw new Error("VAPID subject must be a mailto: or https: contact URI.");
  }

  const { x, y } = parseVapidPublicKey(publicKey);
  const header = encodeJson({ typ: "JWT", alg: "ES256" });
  const payload = encodeJson({
    aud: pushOrigin,
    exp: nowSeconds + VAPID_TTL_SECONDS,
    sub: subject,
  });
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d: privateKey,
    },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(signingInput, "utf8"), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return `vapid t=${signingInput}.${signature}, k=${publicKey}`;
}

export function classifyDeliveryHttpStatus(status: number): DeliveryResult {
  if (status >= 200 && status < 300) {
    return { ok: true, retryable: false, errorCode: null };
  }

  const retryable =
    status === 408 || status === 425 || status === 429 || status >= 500;

  return {
    ok: false,
    retryable,
    errorCode: `HTTP_${status}`,
  };
}

export function isAuthorizedDispatchRequest(
  authorizationHeader: string | null,
  expectedSecret: string | undefined,
): boolean {
  if (!authorizationHeader?.startsWith("Bearer ") || !expectedSecret) {
    return false;
  }

  const providedSecret = authorizationHeader.slice("Bearer ".length);
  const provided = Buffer.from(providedSecret, "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function buildResendRequest({
  apiKey,
  from,
  origin,
  email,
}: {
  apiKey: string;
  from: string;
  origin: string;
  email: TransactionalEmail;
}): { url: string; init: RequestInit } {
  const absoluteActionUrl = new URL(email.actionUrl, origin).toString();
  const text = email.text.includes(email.actionUrl)
    ? email.text.replace(email.actionUrl, absoluteActionUrl)
    : `${email.text}\n\n${absoluteActionUrl}`;
  const html = email.html.includes(`href="${email.actionUrl}"`)
    ? email.html.replace(
        `href="${email.actionUrl}"`,
        `href="${absoluteActionUrl}"`,
      )
    : `${email.html}<p><a href="${absoluteActionUrl}">Abrir en Changas</a></p>`;

  return {
    url: "https://api.resend.com/emails",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.deliveryId,
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text,
        html,
      }),
    },
  };
}
