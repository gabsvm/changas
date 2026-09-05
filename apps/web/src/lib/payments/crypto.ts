import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type PaymentTokenEnvelope = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function decodeCanonicalBase64(value: string, label: string): Buffer {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new Error(`${label} must be canonical base64.`);
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new Error(`${label} must be canonical base64.`);
  }
  return decoded;
}

function decodeEncryptionKey(key: string): Buffer {
  const decoded = decodeCanonicalBase64(key, "Payment token encryption key");
  if (decoded.length !== 32) {
    throw new Error(
      "Payment token encryption key must decode to exactly 32 bytes.",
    );
  }
  return decoded;
}

function assertKeyVersion(keyVersion: number): void {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new Error(
      "Payment token encryption key version must be a positive safe integer.",
    );
  }
}

export function encryptPaymentToken(
  plaintext: string,
  key: string,
  keyVersion: number,
): PaymentTokenEnvelope {
  if (plaintext.length === 0) {
    throw new Error("Payment token plaintext must not be empty.");
  }
  assertKeyVersion(keyVersion);

  const keyBytes = decodeEncryptionKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion,
  };
}

export function decryptPaymentToken(
  envelope: PaymentTokenEnvelope,
  key: string,
): string {
  assertKeyVersion(envelope.keyVersion);
  const keyBytes = decodeEncryptionKey(key);
  const iv = decodeCanonicalBase64(envelope.iv, "Payment token IV");
  const authTag = decodeCanonicalBase64(
    envelope.authTag,
    "Payment token authentication tag",
  );
  const ciphertext = decodeCanonicalBase64(
    envelope.ciphertext,
    "Payment token ciphertext",
  );

  if (iv.length !== 12) {
    throw new Error("Payment token IV must be exactly 12 bytes.");
  }
  if (authTag.length !== 16) {
    throw new Error(
      "Payment token authentication tag must be exactly 16 bytes.",
    );
  }
  if (ciphertext.length === 0) {
    throw new Error("Payment token ciphertext must not be empty.");
  }

  const decipher = createDecipheriv("aes-256-gcm", keyBytes, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
