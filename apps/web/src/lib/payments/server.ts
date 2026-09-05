import "server-only";

import { getPublicSiteUrl } from "@changas/config/public";
import {
  getPaymentServerEnv,
  type PaymentServerEnv,
} from "@changas/config/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { encryptPaymentToken, type PaymentTokenEnvelope } from "./crypto";
import { MercadoPagoPaymentProvider } from "./mercado-pago";
import { createOAuthState, verifyOAuthState } from "./oauth-state";
import type { OAuthCredentials } from "./types";

const MERCADO_PAGO_PROVIDER = "MERCADO_PAGO" as const;
const MERCADO_PAGO_AUTHORIZATION_URL =
  "https://auth.mercadopago.com.ar/authorization";
const OAUTH_CALLBACK_PATH = "/api/payments/mercado-pago/oauth/callback";
const PROVIDER_RETURN_PATH = "/provider/manage";

type PaymentProviderAccountStatus =
  "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED" | "SUSPENDED";

export type ProviderPaymentAccountState = {
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerAccountReference: string | null;
  status: PaymentProviderAccountStatus;
  tokenExpiresAt: string | null;
  updatedAt: string | null;
};

export type PersistPaymentProviderAccountInput = {
  providerUserId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerAccountReference: string;
  accessToken: PaymentTokenEnvelope;
  refreshToken: PaymentTokenEnvelope;
  encryptionKeyVersion: number;
  scope: string | null;
  tokenExpiresAt: string;
  status: "CONNECTED";
};

type PaymentServerErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_OAUTH_STATE"
  | "INVALID_PROVIDER_STATE"
  | "PROVIDER_UNAVAILABLE"
  | "PERSISTENCE_ERROR";

export class PaymentServerError extends Error {
  readonly code: PaymentServerErrorCode;

  constructor(code: PaymentServerErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PaymentServerError";
    this.code = code;
  }
}

type PaymentServerDependencies = {
  now: () => number;
  siteUrl: string | (() => string);
  paymentEnv: PaymentServerEnv | (() => PaymentServerEnv);
  getCurrentUser: () => Promise<{ id: string } | null>;
  hasProviderProfile: (userId: string) => Promise<boolean>;
  getAccountState: (userId: string) => Promise<unknown>;
  upsertAccount: (input: PersistPaymentProviderAccountInput) => Promise<void>;
  paymentProvider: {
    exchangeOAuthCode: (input: {
      code: string;
      redirectUri: string;
    }) => Promise<unknown>;
  };
};

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid payment provider field: ${field}`,
    );
  }
  return value;
}

function normalizeOAuthCredentials(value: unknown): OAuthCredentials {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment provider OAuth response is malformed",
    );
  }

  const expiresInSeconds = value.expiresInSeconds;
  if (
    typeof expiresInSeconds !== "number" ||
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment provider OAuth expiry is invalid",
    );
  }

  const scope = value.scope;
  if (scope !== null && typeof scope !== "string") {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment provider OAuth scope is invalid",
    );
  }

  return {
    accessToken: requireNonEmptyString(value.accessToken, "accessToken"),
    refreshToken: requireNonEmptyString(value.refreshToken, "refreshToken"),
    expiresInSeconds,
    providerAccountReference: requireNonEmptyString(
      value.providerAccountReference,
      "providerAccountReference",
    ),
    scope,
  };
}

function normalizeAccountState(value: unknown): ProviderPaymentAccountState {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Payment account state is malformed",
    );
  }

  const providerName = value.provider_name;
  const providerAccountReference = value.provider_account_reference;
  const status = value.status;
  const tokenExpiresAt = value.token_expires_at;
  const updatedAt = value.updated_at;

  if (providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Unsupported payment provider account state",
    );
  }
  if (
    typeof providerAccountReference !== "string" ||
    providerAccountReference.length === 0
  ) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Payment provider account reference is invalid",
    );
  }
  if (
    status !== "CONNECTED" &&
    status !== "REAUTH_REQUIRED" &&
    status !== "DISCONNECTED" &&
    status !== "SUSPENDED"
  ) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Payment provider account status is invalid",
    );
  }
  if (tokenExpiresAt !== null && typeof tokenExpiresAt !== "string") {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Payment provider token expiry is invalid",
    );
  }
  if (typeof updatedAt !== "string") {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Payment provider account update time is invalid",
    );
  }

  return {
    providerName,
    providerAccountReference,
    status,
    tokenExpiresAt,
    updatedAt,
  };
}

function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function buildCallbackUrl(siteUrl: string): string {
  return new URL(OAUTH_CALLBACK_PATH, siteUrl).toString();
}

export function createPaymentServer(dependencies: PaymentServerDependencies) {
  async function requireProviderUser(): Promise<{ id: string }> {
    const user = await dependencies.getCurrentUser();
    if (!user) {
      throw new PaymentServerError(
        "UNAUTHORIZED",
        "Authentication is required for payment provider access",
      );
    }

    const providerExists = await dependencies.hasProviderProfile(user.id);
    if (!providerExists) {
      throw new PaymentServerError(
        "FORBIDDEN",
        "A provider profile is required for payment provider access",
      );
    }
    return user;
  }

  async function getProviderPaymentAccountState(): Promise<ProviderPaymentAccountState> {
    const user = await requireProviderUser();
    const rawState = await dependencies.getAccountState(user.id);
    if (rawState === null || rawState === undefined) {
      return {
        providerName: MERCADO_PAGO_PROVIDER,
        providerAccountReference: null,
        status: "DISCONNECTED",
        tokenExpiresAt: null,
        updatedAt: null,
      };
    }
    return normalizeAccountState(rawState);
  }

  async function buildMercadoPagoOAuthRedirect(): Promise<string> {
    const user = await requireProviderUser();
    const now = dependencies.now();
    const paymentEnv = resolveValue(dependencies.paymentEnv);
    const siteUrl = resolveValue(dependencies.siteUrl);
    const state = createOAuthState(
      {
        providerUserId: user.id,
        returnPath: PROVIDER_RETURN_PATH,
      },
      paymentEnv.oauthStateSecret,
      now,
    );

    const url = new URL(MERCADO_PAGO_AUTHORIZATION_URL);
    url.searchParams.set("client_id", paymentEnv.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", buildCallbackUrl(siteUrl));
    return url.toString();
  }

  async function completeMercadoPagoOAuthCallback(input: {
    code: string;
    state: string;
  }) {
    const user = await requireProviderUser();
    const now = dependencies.now();
    const paymentEnv = resolveValue(dependencies.paymentEnv);
    const siteUrl = resolveValue(dependencies.siteUrl);

    let verifiedState;
    try {
      verifiedState = verifyOAuthState(
        input.state,
        paymentEnv.oauthStateSecret,
        now,
      );
    } catch (error) {
      throw new PaymentServerError(
        "INVALID_OAUTH_STATE",
        "OAuth state validation failed",
        error,
      );
    }

    if (verifiedState.providerUserId !== user.id) {
      throw new PaymentServerError(
        "FORBIDDEN",
        "OAuth state does not belong to the authenticated provider",
      );
    }

    let credentials: OAuthCredentials;
    try {
      credentials = normalizeOAuthCredentials(
        await dependencies.paymentProvider.exchangeOAuthCode({
          code: requireNonEmptyString(input.code, "code"),
          redirectUri: buildCallbackUrl(siteUrl),
        }),
      );
    } catch (error) {
      if (error instanceof PaymentServerError) throw error;
      throw new PaymentServerError(
        "PROVIDER_UNAVAILABLE",
        "Mercado Pago OAuth exchange failed",
        error,
      );
    }

    const expiresAtMs = now + credentials.expiresInSeconds * 1000;
    if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= now) {
      throw new PaymentServerError(
        "INVALID_PROVIDER_STATE",
        "Mercado Pago OAuth expiry is outside supported bounds",
      );
    }

    const accessToken = encryptPaymentToken(
      credentials.accessToken,
      paymentEnv.tokenEncryptionKey,
      paymentEnv.tokenEncryptionKeyVersion,
    );
    const refreshToken = encryptPaymentToken(
      credentials.refreshToken,
      paymentEnv.tokenEncryptionKey,
      paymentEnv.tokenEncryptionKeyVersion,
    );
    const tokenExpiresAt = new Date(expiresAtMs).toISOString();

    try {
      await dependencies.upsertAccount({
        providerUserId: user.id,
        providerName: MERCADO_PAGO_PROVIDER,
        providerAccountReference: credentials.providerAccountReference,
        accessToken,
        refreshToken,
        encryptionKeyVersion: paymentEnv.tokenEncryptionKeyVersion,
        scope: credentials.scope,
        tokenExpiresAt,
        status: "CONNECTED",
      });
    } catch (error) {
      throw new PaymentServerError(
        "PERSISTENCE_ERROR",
        "Unable to persist payment provider account",
        error,
      );
    }

    return {
      returnPath: verifiedState.returnPath,
      account: {
        providerName: MERCADO_PAGO_PROVIDER,
        providerAccountReference: credentials.providerAccountReference,
        status: "CONNECTED" as const,
        tokenExpiresAt,
        updatedAt: null,
      },
    };
  }

  return {
    getProviderPaymentAccountState,
    buildMercadoPagoOAuthRedirect,
    completeMercadoPagoOAuthCallback,
  };
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

async function hasProviderProfile(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Unable to verify provider profile",
      error,
    );
  }
  return data !== null;
}

async function getAccountState(_userId: string): Promise<unknown> {
  const supabase = (await createClient()) as unknown as RpcClient;
  const { data, error } = await supabase.rpc(
    "get_my_payment_provider_account_state",
  );
  if (error) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Unable to read payment provider account state",
      error,
    );
  }

  if (!Array.isArray(data)) return data;
  const mercadoPago = data.find(
    (row) => isRecord(row) && row.provider_name === MERCADO_PAGO_PROVIDER,
  );
  return mercadoPago ?? null;
}

async function upsertAccount(
  input: PersistPaymentProviderAccountInput,
): Promise<void> {
  const admin = createAdminClient() as unknown as RpcClient;
  const { error } = await admin.rpc("upsert_payment_provider_account", {
    target_provider_user_id: input.providerUserId,
    payment_provider_name: input.providerName,
    payment_provider_account_reference: input.providerAccountReference,
    encrypted_access_token_ciphertext: input.accessToken.ciphertext,
    encrypted_access_token_iv: input.accessToken.iv,
    encrypted_access_token_auth_tag: input.accessToken.authTag,
    encrypted_refresh_token_ciphertext: input.refreshToken.ciphertext,
    encrypted_refresh_token_iv: input.refreshToken.iv,
    encrypted_refresh_token_auth_tag: input.refreshToken.authTag,
    token_encryption_key_version: input.encryptionKeyVersion,
    granted_scope: input.scope,
    access_token_expires_at: input.tokenExpiresAt,
    account_status: input.status,
  });
  if (error) {
    throw new PaymentServerError(
      "PERSISTENCE_ERROR",
      "Unable to write payment provider account",
      error,
    );
  }
}

let defaultPaymentServer: ReturnType<typeof createPaymentServer> | null = null;

function getDefaultPaymentServer() {
  if (defaultPaymentServer) return defaultPaymentServer;

  defaultPaymentServer = createPaymentServer({
    now: Date.now,
    siteUrl: getPublicSiteUrl,
    paymentEnv: getPaymentServerEnv,
    getCurrentUser,
    hasProviderProfile,
    getAccountState,
    upsertAccount,
    paymentProvider: {
      async exchangeOAuthCode(input) {
        const paymentEnv = getPaymentServerEnv();
        const provider = new MercadoPagoPaymentProvider({
          clientId: paymentEnv.clientId,
          clientSecret: paymentEnv.clientSecret,
          webhookSecret: paymentEnv.webhookSecret,
        });
        return provider.exchangeOAuthCode(input);
      },
    },
  });
  return defaultPaymentServer;
}

export async function getProviderPaymentAccountState() {
  return getDefaultPaymentServer().getProviderPaymentAccountState();
}

export async function buildMercadoPagoOAuthRedirect() {
  return getDefaultPaymentServer().buildMercadoPagoOAuthRedirect();
}

export async function completeMercadoPagoOAuthCallback(input: {
  code: string;
  state: string;
}) {
  return getDefaultPaymentServer().completeMercadoPagoOAuthCallback(input);
}
