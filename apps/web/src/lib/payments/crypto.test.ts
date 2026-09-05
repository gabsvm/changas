import { describe, expect, it } from "vitest";

import { decryptPaymentToken, encryptPaymentToken } from "./crypto";

const KEY = Buffer.alloc(32, 17).toString("base64");
const WRONG_KEY = Buffer.alloc(32, 18).toString("base64");

describe("Phase 11 payment token encryption", () => {
  it("round-trips token material without exposing plaintext in the envelope", () => {
    const token = "APP_USR-sensitive-seller-token";
    const envelope = encryptPaymentToken(token, KEY, 1);

    expect(envelope.keyVersion).toBe(1);
    expect(envelope.iv).not.toBe("");
    expect(envelope.authTag).not.toBe("");
    expect(envelope.ciphertext).not.toContain(token);
    expect(decryptPaymentToken(envelope, KEY)).toBe(token);
  });

  it("uses a fresh nonce for each encryption", () => {
    const first = encryptPaymentToken("same-token", KEY, 1);
    const second = encryptPaymentToken("same-token", KEY, 1);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects tampered ciphertext and authentication tags", () => {
    const encrypted = encryptPaymentToken("seller-token", KEY, 1);
    const tamperedCiphertext = {
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    const tamperedTag = {
      ...encrypted,
      authTag: Buffer.alloc(16, 4).toString("base64"),
    };

    expect(() => decryptPaymentToken(tamperedCiphertext, KEY)).toThrow();
    expect(() => decryptPaymentToken(tamperedTag, KEY)).toThrow();
  });

  it("rejects the wrong key and malformed envelopes", () => {
    const encrypted = encryptPaymentToken("seller-token", KEY, 1);

    expect(() => decryptPaymentToken(encrypted, WRONG_KEY)).toThrow();
    expect(() =>
      decryptPaymentToken({ ...encrypted, iv: "not-base64!!!" }, KEY),
    ).toThrow();
    expect(() => encryptPaymentToken("", KEY, 1)).toThrow();
    expect(() =>
      encryptPaymentToken(
        "seller-token",
        Buffer.alloc(31).toString("base64"),
        1,
      ),
    ).toThrow();
    expect(() => encryptPaymentToken("seller-token", KEY, 0)).toThrow();
  });
});
