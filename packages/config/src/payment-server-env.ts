export type PaymentProviderMode = "test" | "live";

export type PaymentServerEnv = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  tokenEncryptionKey: string;
  tokenEncryptionKeyVersion: number;
  oauthStateSecret: string;
  marketplaceFeeBps: number;
  providerMode: PaymentProviderMode;
};

type PaymentServerEnvSource = Record<string, string | undefined>;

function requireValue(source: PaymentServerEnvSource, name: string): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`Missing required payment server environment variable: ${name}`);
  }
  return value;
}

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

function parseSafeInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a safe integer.`);
  }
  return parsed;
}

export function parsePaymentServerEnv(
  source: PaymentServerEnvSource,
): PaymentServerEnv {
  const clientId = requireValue(source, "MERCADO_PAGO_CLIENT_ID");
  const clientSecret = requireValue(source, "MERCADO_PAGO_CLIENT_SECRET");
  const webhookSecret = requireValue(source, "MERCADO_PAGO_WEBHOOK_SECRET");
  const tokenEncryptionKey = requireValue(
    source,
    "PAYMENT_TOKEN_ENCRYPTION_KEY_V1",
  );
  const tokenEncryptionKeyVersionValue = requireValue(
    source,
    "PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION",
  );
  const oauthStateSecret = requireValue(source, "PAYMENT_OAUTH_STATE_SECRET");
  const marketplaceFeeBpsValue = requireValue(
    source,
    "CHANGAS_MARKETPLACE_FEE_BPS",
  );
  const providerModeValue = requireValue(source, "MERCADO_PAGO_MODE");

  const tokenKeyBytes = decodeCanonicalBase64(
    tokenEncryptionKey,
    "PAYMENT_TOKEN_ENCRYPTION_KEY_V1",
  );
  if (tokenKeyBytes.length !== 32) {
    throw new Error(
      "PAYMENT_TOKEN_ENCRYPTION_KEY_V1 must decode to exactly 32 bytes.",
    );
  }

  const oauthStateSecretBytes = decodeCanonicalBase64(
    oauthStateSecret,
    "PAYMENT_OAUTH_STATE_SECRET",
  );
  if (oauthStateSecretBytes.length < 32) {
    throw new Error(
      "PAYMENT_OAUTH_STATE_SECRET must decode to at least 32 bytes.",
    );
  }

  const tokenEncryptionKeyVersion = parseSafeInteger(
    tokenEncryptionKeyVersionValue,
    "PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION",
  );
  if (tokenEncryptionKeyVersion < 1) {
    throw new Error("PAYMENT_TOKEN_ENCRYPTION_KEY_VERSION must be at least 1.");
  }

  const marketplaceFeeBps = parseSafeInteger(
    marketplaceFeeBpsValue,
    "CHANGAS_MARKETPLACE_FEE_BPS",
  );
  if (marketplaceFeeBps < 0 || marketplaceFeeBps > 10_000) {
    throw new Error("CHANGAS_MARKETPLACE_FEE_BPS must be between 0 and 10000.");
  }

  if (providerModeValue !== "test" && providerModeValue !== "live") {
    throw new Error("MERCADO_PAGO_MODE must be either test or live.");
  }

  return {
    clientId,
    clientSecret,
    webhookSecret,
    tokenEncryptionKey,
    tokenEncryptionKeyVersion,
    oauthStateSecret,
    marketplaceFeeBps,
    providerMode: providerModeValue,
  };
}

export function getPaymentServerEnv(): PaymentServerEnv {
  return parsePaymentServerEnv(process.env);
}
