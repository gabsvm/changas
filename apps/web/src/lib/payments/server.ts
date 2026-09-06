import "server-only";

import { randomUUID } from "node:crypto";

import {
  calculateMarketplaceFeeMinor,
  calculateProviderExpectedNetMinor,
} from "@changas/domain";
import { getPublicSiteUrl } from "@changas/config/public";
import {
  getPaymentServerEnv,
  type PaymentServerEnv,
} from "@changas/config/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  decryptPaymentToken,
  encryptPaymentToken,
  type PaymentTokenEnvelope,
} from "./crypto";
import { MercadoPagoPaymentProvider } from "./mercado-pago";
import { createOAuthState, verifyOAuthState } from "./oauth-state";
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  OAuthCredentials,
} from "./types";

const MERCADO_PAGO_PROVIDER = "MERCADO_PAGO" as const;
const MERCADO_PAGO_AUTHORIZATION_URL =
  "https://auth.mercadopago.com.ar/authorization";
const OAUTH_CALLBACK_PATH = "/api/payments/mercado-pago/oauth/callback";
const WEBHOOK_PATH = "/api/payments/mercado-pago/webhook";
const PROVIDER_RETURN_PATH = "/provider/manage";
const RETURN_SUCCESS_PATH = "/payments/return/success";
const RETURN_PENDING_PATH = "/payments/return/pending";
const RETURN_FAILURE_PATH = "/payments/return/failure";

type PaymentProviderAccountStatus =
  "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED" | "SUSPENDED";

type CheckoutPurpose = "PROPOSAL" | "SCOPE_CHANGE";
type CheckoutStatus =
  | "CREATED"
  | "REDIRECT_READY"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED";

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

type CheckoutAuthoritySnapshot = {
  targetId: string;
  clientUserId: string;
  providerUserId: string;
  status: string;
  serviceTitle: string;
  scopeSnapshot: string;
  amountMinor: number;
  currencyCode: string;
};

type ConnectedProviderAccount = {
  id: string;
  providerUserId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  providerAccountReference: string;
  status: PaymentProviderAccountStatus;
  accessToken: PaymentTokenEnvelope | null;
  encryptionKeyVersion: number | null;
};

type CheckoutRecord = {
  id: string;
  requestNonce: string;
  purpose: CheckoutPurpose;
  targetId: string;
  clientUserId: string;
  providerUserId: string;
  paymentProviderAccountId: string;
  providerName: typeof MERCADO_PAGO_PROVIDER;
  externalReference: string;
  amountMinor: number;
  marketplaceFeeMinor: number;
  providerNetExpectedMinor: number;
  currencyCode: string;
  status: CheckoutStatus;
  providerCheckoutReference: string | null;
  checkoutUrl: string | null;
};

type CheckoutRecordInput = CheckoutRecord & {
  status: "CREATED";
  providerCheckoutReference: null;
  checkoutUrl: null;
};

type CheckoutRedirectResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
};

type PaymentServerErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SELLER_NOT_CONNECTED"
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
  loadProposalCheckoutSnapshot?: (proposalId: string) => Promise<unknown>;
  loadScopeChangeCheckoutSnapshot?: (scopeChangeId: string) => Promise<unknown>;
  loadConnectedProviderAccount?: (providerUserId: string) => Promise<unknown>;
  findCheckoutByNonce?: (requestNonce: string) => Promise<unknown>;
  createCheckoutRecord?: (input: CheckoutRecordInput) => Promise<unknown>;
  markCheckoutRedirectReady?: (input: {
    checkoutId: string;
    providerCheckoutReference: string;
    checkoutUrl: string;
  }) => Promise<void>;
  paymentProvider: {
    exchangeOAuthCode: (input: {
      code: string;
      redirectUri: string;
    }) => Promise<unknown>;
    createCheckoutSession?: (
      input: CheckoutSessionInput,
    ) => Promise<CheckoutSessionResult>;
  };
};

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

type SelectQuery = {
  eq: (column: string, value: unknown) => SelectQuery;
  maybeSingle: () => PromiseLike<RpcResult>;
  single: () => PromiseLike<RpcResult>;
};

type MutationQuery = {
  eq: (column: string, value: unknown) => MutationQuery;
  select: (columns: string) => SelectQuery;
};

type TableQuery = {
  select: (columns: string) => SelectQuery;
  insert: (values: Record<string, unknown>) => MutationQuery;
  update: (values: Record<string, unknown>) => MutationQuery;
};

type TableClient = {
  from: (table: string) => TableQuery;
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

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requireNonEmptyString(value, field);
}

function requirePositiveSafeInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid positive integer field: ${field}`,
    );
  }
  return value;
}

function requireNonNegativeSafeInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      `Invalid non-negative integer field: ${field}`,
    );
  }
  return value;
}

function requireCurrency(value: unknown): string {
  const currency = requireNonEmptyString(value, "currencyCode");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payment currency is invalid",
    );
  }
  return currency;
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

function normalizeCheckoutSnapshot(
  value: unknown,
  expectedTargetId: string,
): CheckoutAuthoritySnapshot {
  if (!isRecord(value)) {
    throw new PaymentServerError("NOT_FOUND", "Payable snapshot was not found");
  }

  const targetId =
    typeof value.targetId === "string"
      ? value.targetId
      : typeof value.proposalId === "string"
        ? value.proposalId
        : typeof value.scopeChangeId === "string"
          ? value.scopeChangeId
          : null;
  if (targetId !== expectedTargetId) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Payable snapshot target mismatch",
    );
  }

  const status = requireNonEmptyString(value.status, "status");
  if (status !== "AWAITING_PAYMENT" && status !== "PAYMENT_FAILED") {
    throw new PaymentServerError("FORBIDDEN", "Economic snapshot is not payable");
  }

  return {
    targetId,
    clientUserId: requireNonEmptyString(value.clientUserId, "clientUserId"),
    providerUserId: requireNonEmptyString(
      value.providerUserId,
      "providerUserId",
    ),
    status,
    serviceTitle: requireNonEmptyString(value.serviceTitle, "serviceTitle"),
    scopeSnapshot: requireNonEmptyString(value.scopeSnapshot, "scopeSnapshot"),
    amountMinor: requirePositiveSafeInteger(value.amountMinor, "amountMinor"),
    currencyCode: requireCurrency(value.currencyCode),
  };
}

function normalizeProviderCheckoutAccount(value: unknown): ConnectedProviderAccount {
  if (!isRecord(value) || value.status !== "CONNECTED") {
    throw new PaymentServerError(
      "SELLER_NOT_CONNECTED",
      "Provider must connect Mercado Pago before checkout",
    );
  }
  if (value.providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Unsupported connected payment provider",
    );
  }

  const keyVersion = requirePositiveSafeInteger(
    value.encryptionKeyVersion,
    "encryptionKeyVersion",
  );
  const rawEnvelope = value.accessToken;
  if (!isRecord(rawEnvelope)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Connected provider access token is unavailable",
    );
  }

  const envelope: PaymentTokenEnvelope = {
    ciphertext: requireNonEmptyString(rawEnvelope.ciphertext, "ciphertext"),
    iv: requireNonEmptyString(rawEnvelope.iv, "iv"),
    authTag: requireNonEmptyString(rawEnvelope.authTag, "authTag"),
    keyVersion: requirePositiveSafeInteger(rawEnvelope.keyVersion, "keyVersion"),
  };
  if (envelope.keyVersion !== keyVersion) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Connected provider token key version mismatch",
    );
  }

  return {
    id: requireNonEmptyString(value.id, "providerAccountId"),
    providerUserId: requireNonEmptyString(
      value.providerUserId,
      "providerUserId",
    ),
    providerName: MERCADO_PAGO_PROVIDER,
    providerAccountReference: requireNonEmptyString(
      value.providerAccountReference,
      "providerAccountReference",
    ),
    status: "CONNECTED",
    accessToken: envelope,
    encryptionKeyVersion: keyVersion,
  };
}

function normalizeCheckoutRecord(value: unknown): CheckoutRecord {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Checkout session row is malformed",
    );
  }
  const purpose = value.purpose;
  if (purpose !== "PROPOSAL" && purpose !== "SCOPE_CHANGE") {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Checkout purpose is invalid",
    );
  }
  const status = value.status;
  if (
    status !== "CREATED" &&
    status !== "REDIRECT_READY" &&
    status !== "COMPLETED" &&
    status !== "EXPIRED" &&
    status !== "FAILED"
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Checkout status is invalid",
    );
  }
  if (value.providerName !== MERCADO_PAGO_PROVIDER) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Checkout provider is invalid",
    );
  }

  return {
    id: requireNonEmptyString(value.id, "checkoutId"),
    requestNonce: requireNonEmptyString(value.requestNonce, "requestNonce"),
    purpose,
    targetId: requireNonEmptyString(value.targetId, "targetId"),
    clientUserId: requireNonEmptyString(value.clientUserId, "clientUserId"),
    providerUserId: requireNonEmptyString(
      value.providerUserId,
      "providerUserId",
    ),
    paymentProviderAccountId: requireNonEmptyString(
      value.paymentProviderAccountId,
      "paymentProviderAccountId",
    ),
    providerName: MERCADO_PAGO_PROVIDER,
    externalReference: requireNonEmptyString(
      value.externalReference,
      "externalReference",
    ),
    amountMinor: requirePositiveSafeInteger(value.amountMinor, "amountMinor"),
    marketplaceFeeMinor: requireNonNegativeSafeInteger(
      value.marketplaceFeeMinor,
      "marketplaceFeeMinor",
    ),
    providerNetExpectedMinor: requireNonNegativeSafeInteger(
      value.providerNetExpectedMinor,
      "providerNetExpectedMinor",
    ),
    currencyCode: requireCurrency(value.currencyCode),
    status,
    providerCheckoutReference: requireNullableString(
      value.providerCheckoutReference,
      "providerCheckoutReference",
    ),
    checkoutUrl: requireNullableString(value.checkoutUrl, "checkoutUrl"),
  };
}

function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function buildCallbackUrl(siteUrl: string): string {
  return new URL(OAUTH_CALLBACK_PATH, siteUrl).toString();
}

function buildExternalReference(requestNonce: string): string {
  return `changas:checkout:${requestNonce}`;
}

function getCheckoutDependencies(dependencies: PaymentServerDependencies) {
  if (
    !dependencies.loadProposalCheckoutSnapshot ||
    !dependencies.loadScopeChangeCheckoutSnapshot ||
    !dependencies.loadConnectedProviderAccount ||
    !dependencies.findCheckoutByNonce ||
    !dependencies.createCheckoutRecord ||
    !dependencies.markCheckoutRedirectReady ||
    !dependencies.paymentProvider.createCheckoutSession
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Real checkout dependencies are not configured",
    );
  }

  return {
    loadProposalCheckoutSnapshot: dependencies.loadProposalCheckoutSnapshot,
    loadScopeChangeCheckoutSnapshot:
      dependencies.loadScopeChangeCheckoutSnapshot,
    loadConnectedProviderAccount: dependencies.loadConnectedProviderAccount,
    findCheckoutByNonce: dependencies.findCheckoutByNonce,
    createCheckoutRecord: dependencies.createCheckoutRecord,
    markCheckoutRedirectReady: dependencies.markCheckoutRedirectReady,
    createCheckoutSession: dependencies.paymentProvider.createCheckoutSession,
  };
}

export function createPaymentServer(dependencies: PaymentServerDependencies) {
  async function requireCurrentUser(): Promise<{ id: string }> {
    const user = await dependencies.getCurrentUser();
    if (!user) {
      throw new PaymentServerError(
        "UNAUTHORIZED",
        "Authentication is required for payment access",
      );
    }
    return user;
  }

  async function requireProviderUser(): Promise<{ id: string }> {
    const user = await requireCurrentUser();
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

  async function createHostedCheckout(
    purpose: CheckoutPurpose,
    targetId: string,
    requestNonce: string,
  ): Promise<CheckoutRedirectResult> {
    const checkoutDependencies = getCheckoutDependencies(dependencies);
    const user = await requireCurrentUser();
    requireNonEmptyString(targetId, "targetId");
    requireNonEmptyString(requestNonce, "requestNonce");

    const existingRaw =
      await checkoutDependencies.findCheckoutByNonce(requestNonce);
    let checkout: CheckoutRecord | null = null;
    if (existingRaw !== null && existingRaw !== undefined) {
      checkout = normalizeCheckoutRecord(existingRaw);
      if (checkout.clientUserId !== user.id) {
        throw new PaymentServerError(
          "FORBIDDEN",
          "Checkout nonce belongs to another client",
        );
      }
      if (checkout.purpose !== purpose || checkout.targetId !== targetId) {
        throw new PaymentServerError(
          "CONFLICT",
          "Checkout nonce is already bound to another economic snapshot",
        );
      }
      if (checkout.status === "REDIRECT_READY" && checkout.checkoutUrl) {
        return {
          checkoutSessionId: checkout.id,
          checkoutUrl: checkout.checkoutUrl,
        };
      }
      if (checkout.status !== "CREATED") {
        throw new PaymentServerError(
          "CONFLICT",
          "Checkout session cannot be redirected in its current state",
        );
      }
    }

    const rawSnapshot =
      purpose === "PROPOSAL"
        ? await checkoutDependencies.loadProposalCheckoutSnapshot(targetId)
        : await checkoutDependencies.loadScopeChangeCheckoutSnapshot(targetId);
    const snapshot = normalizeCheckoutSnapshot(rawSnapshot, targetId);
    if (snapshot.clientUserId !== user.id) {
      throw new PaymentServerError(
        "FORBIDDEN",
        "Only the economic snapshot client can create checkout",
      );
    }

    const account = normalizeProviderCheckoutAccount(
      await checkoutDependencies.loadConnectedProviderAccount(
        snapshot.providerUserId,
      ),
    );
    if (account.providerUserId !== snapshot.providerUserId) {
      throw new PaymentServerError(
        "INVALID_PROVIDER_STATE",
        "Connected seller account does not match the economic snapshot",
      );
    }

    const paymentEnv = resolveValue(dependencies.paymentEnv);
    if (
      account.encryptionKeyVersion !== paymentEnv.tokenEncryptionKeyVersion ||
      !account.accessToken
    ) {
      throw new PaymentServerError(
        "SELLER_NOT_CONNECTED",
        "Seller payment authorization must be refreshed",
      );
    }

    let accessToken: string;
    try {
      accessToken = decryptPaymentToken(
        account.accessToken,
        paymentEnv.tokenEncryptionKey,
      );
    } catch (error) {
      throw new PaymentServerError(
        "SELLER_NOT_CONNECTED",
        "Seller payment authorization cannot be decrypted",
        error,
      );
    }

    const marketplaceFeeMinor = calculateMarketplaceFeeMinor(
      snapshot.amountMinor,
      paymentEnv.marketplaceFeeBps,
    );
    const providerNetExpectedMinor = calculateProviderExpectedNetMinor(
      snapshot.amountMinor,
      marketplaceFeeMinor,
    );
    const externalReference = buildExternalReference(requestNonce);

    if (checkout) {
      if (
        checkout.providerUserId !== snapshot.providerUserId ||
        checkout.paymentProviderAccountId !== account.id ||
        checkout.amountMinor !== snapshot.amountMinor ||
        checkout.marketplaceFeeMinor !== marketplaceFeeMinor ||
        checkout.providerNetExpectedMinor !== providerNetExpectedMinor ||
        checkout.currencyCode !== snapshot.currencyCode ||
        checkout.externalReference !== externalReference
      ) {
        throw new PaymentServerError(
          "CONFLICT",
          "Durable checkout no longer matches its economic snapshot",
        );
      }
    } else {
      const input: CheckoutRecordInput = {
        id: randomUUID(),
        requestNonce,
        purpose,
        targetId,
        clientUserId: user.id,
        providerUserId: snapshot.providerUserId,
        paymentProviderAccountId: account.id,
        providerName: MERCADO_PAGO_PROVIDER,
        externalReference,
        amountMinor: snapshot.amountMinor,
        marketplaceFeeMinor,
        providerNetExpectedMinor,
        currencyCode: snapshot.currencyCode,
        status: "CREATED",
        providerCheckoutReference: null,
        checkoutUrl: null,
      };
      try {
        checkout = normalizeCheckoutRecord(
          await checkoutDependencies.createCheckoutRecord(input),
        );
      } catch (error) {
        const raced = await checkoutDependencies.findCheckoutByNonce(
          requestNonce,
        );
        if (raced === null || raced === undefined) throw error;
        checkout = normalizeCheckoutRecord(raced);
        if (
          checkout.clientUserId !== user.id ||
          checkout.purpose !== purpose ||
          checkout.targetId !== targetId ||
          checkout.status !== "CREATED"
        ) {
          throw new PaymentServerError(
            "CONFLICT",
            "Concurrent checkout creation produced a conflicting session",
            error,
          );
        }
      }
    }

    const siteUrl = resolveValue(dependencies.siteUrl);
    const providerSession = await checkoutDependencies.createCheckoutSession({
      accessToken,
      title: snapshot.serviceTitle,
      description: snapshot.scopeSnapshot,
      amountMinor: snapshot.amountMinor,
      currencyCode: snapshot.currencyCode,
      marketplaceFeeMinor,
      externalReference,
      notificationUrl: new URL(WEBHOOK_PATH, siteUrl).toString(),
      backUrls: {
        success: new URL(RETURN_SUCCESS_PATH, siteUrl).toString(),
        pending: new URL(RETURN_PENDING_PATH, siteUrl).toString(),
        failure: new URL(RETURN_FAILURE_PATH, siteUrl).toString(),
      },
      idempotencyKey: requestNonce,
    });

    await checkoutDependencies.markCheckoutRedirectReady({
      checkoutId: checkout.id,
      providerCheckoutReference: providerSession.providerCheckoutReference,
      checkoutUrl: providerSession.checkoutUrl,
    });

    return {
      checkoutSessionId: checkout.id,
      checkoutUrl: providerSession.checkoutUrl,
    };
  }

  async function createProposalCheckout(
    proposalId: string,
    requestNonce: string,
  ) {
    return createHostedCheckout("PROPOSAL", proposalId, requestNonce);
  }

  async function createScopeChangeCheckout(
    scopeChangeId: string,
    requestNonce: string,
  ) {
    return createHostedCheckout("SCOPE_CHANGE", scopeChangeId, requestNonce);
  }

  return {
    getProviderPaymentAccountState,
    buildMercadoPagoOAuthRedirect,
    completeMercadoPagoOAuthCallback,
    createProposalCheckout,
    createScopeChangeCheckout,
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

function getAdminTableClient(): TableClient {
  return createAdminClient() as unknown as TableClient;
}

function throwDatabaseError(message: string, error: unknown): never {
  throw new PaymentServerError("PERSISTENCE_ERROR", message, error);
}

async function loadProposalCheckoutSnapshot(
  proposalId: string,
): Promise<CheckoutAuthoritySnapshot> {
  const admin = getAdminTableClient();
  const proposalResult = await admin
    .from("proposals")
    .select("id,client_user_id,provider_user_id,status,accepted_version_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (proposalResult.error) {
    throwDatabaseError("Unable to load proposal checkout snapshot", proposalResult.error);
  }
  if (!isRecord(proposalResult.data)) {
    throw new PaymentServerError("NOT_FOUND", "Proposal was not found");
  }

  const acceptedVersionId = requireNonEmptyString(
    proposalResult.data.accepted_version_id,
    "acceptedVersionId",
  );
  const versionResult = await admin
    .from("proposal_versions")
    .select(
      "id,proposal_id,service_title_snapshot,scope_snapshot,price_amount,currency_code",
    )
    .eq("id", acceptedVersionId)
    .maybeSingle();
  if (versionResult.error) {
    throwDatabaseError("Unable to load accepted proposal version", versionResult.error);
  }
  if (!isRecord(versionResult.data)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Accepted proposal version was not found",
    );
  }
  if (versionResult.data.proposal_id !== proposalId) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Accepted proposal version does not belong to proposal",
    );
  }

  return {
    targetId: proposalId,
    clientUserId: requireNonEmptyString(
      proposalResult.data.client_user_id,
      "clientUserId",
    ),
    providerUserId: requireNonEmptyString(
      proposalResult.data.provider_user_id,
      "providerUserId",
    ),
    status: requireNonEmptyString(proposalResult.data.status, "status"),
    serviceTitle: requireNonEmptyString(
      versionResult.data.service_title_snapshot,
      "serviceTitle",
    ),
    scopeSnapshot: requireNonEmptyString(
      versionResult.data.scope_snapshot,
      "scopeSnapshot",
    ),
    amountMinor: requirePositiveSafeInteger(
      versionResult.data.price_amount,
      "amountMinor",
    ),
    currencyCode: requireCurrency(versionResult.data.currency_code),
  };
}

async function loadScopeChangeCheckoutSnapshot(
  scopeChangeId: string,
): Promise<CheckoutAuthoritySnapshot> {
  const admin = getAdminTableClient();
  const changeResult = await admin
    .from("job_scope_changes")
    .select(
      "id,job_id,status,scope_snapshot,additional_amount_minor,currency_code",
    )
    .eq("id", scopeChangeId)
    .maybeSingle();
  if (changeResult.error) {
    throwDatabaseError("Unable to load scope-change checkout snapshot", changeResult.error);
  }
  if (!isRecord(changeResult.data)) {
    throw new PaymentServerError("NOT_FOUND", "Scope change was not found");
  }

  const jobId = requireNonEmptyString(changeResult.data.job_id, "jobId");
  const jobResult = await admin
    .from("jobs")
    .select("id,client_user_id,provider_user_id,accepted_proposal_version_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobResult.error) {
    throwDatabaseError("Unable to load scope-change job", jobResult.error);
  }
  if (!isRecord(jobResult.data)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Scope-change job was not found",
    );
  }

  const acceptedVersionId = requireNonEmptyString(
    jobResult.data.accepted_proposal_version_id,
    "acceptedVersionId",
  );
  const versionResult = await admin
    .from("proposal_versions")
    .select("id,service_title_snapshot")
    .eq("id", acceptedVersionId)
    .maybeSingle();
  if (versionResult.error) {
    throwDatabaseError("Unable to load scope-change service snapshot", versionResult.error);
  }
  if (!isRecord(versionResult.data)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Scope-change service snapshot was not found",
    );
  }

  return {
    targetId: scopeChangeId,
    clientUserId: requireNonEmptyString(
      jobResult.data.client_user_id,
      "clientUserId",
    ),
    providerUserId: requireNonEmptyString(
      jobResult.data.provider_user_id,
      "providerUserId",
    ),
    status: requireNonEmptyString(changeResult.data.status, "status"),
    serviceTitle: requireNonEmptyString(
      versionResult.data.service_title_snapshot,
      "serviceTitle",
    ),
    scopeSnapshot: requireNonEmptyString(
      changeResult.data.scope_snapshot,
      "scopeSnapshot",
    ),
    amountMinor: requirePositiveSafeInteger(
      changeResult.data.additional_amount_minor,
      "amountMinor",
    ),
    currencyCode: requireCurrency(changeResult.data.currency_code),
  };
}

async function loadConnectedProviderAccount(
  providerUserId: string,
): Promise<ConnectedProviderAccount | null> {
  const admin = getAdminTableClient();
  const result = await admin
    .from("payment_provider_accounts")
    .select(
      "id,provider_user_id,provider_name,provider_account_reference,status,access_token_ciphertext,access_token_iv,access_token_auth_tag,encryption_key_version",
    )
    .eq("provider_user_id", providerUserId)
    .eq("provider_name", MERCADO_PAGO_PROVIDER)
    .maybeSingle();
  if (result.error) {
    throwDatabaseError("Unable to load seller payment account", result.error);
  }
  if (!isRecord(result.data)) return null;

  const status = requireNonEmptyString(result.data.status, "status");
  if (
    status !== "CONNECTED" &&
    status !== "REAUTH_REQUIRED" &&
    status !== "DISCONNECTED" &&
    status !== "SUSPENDED"
  ) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Seller payment account status is invalid",
    );
  }
  const keyVersion = requirePositiveSafeInteger(
    result.data.encryption_key_version,
    "encryptionKeyVersion",
  );

  return {
    id: requireNonEmptyString(result.data.id, "providerAccountId"),
    providerUserId: requireNonEmptyString(
      result.data.provider_user_id,
      "providerUserId",
    ),
    providerName: MERCADO_PAGO_PROVIDER,
    providerAccountReference: requireNonEmptyString(
      result.data.provider_account_reference,
      "providerAccountReference",
    ),
    status,
    accessToken: {
      ciphertext: requireNonEmptyString(
        result.data.access_token_ciphertext,
        "ciphertext",
      ),
      iv: requireNonEmptyString(result.data.access_token_iv, "iv"),
      authTag: requireNonEmptyString(
        result.data.access_token_auth_tag,
        "authTag",
      ),
      keyVersion,
    },
    encryptionKeyVersion: keyVersion,
  };
}

function mapCheckoutDatabaseRow(value: unknown): CheckoutRecord {
  if (!isRecord(value)) {
    throw new PaymentServerError(
      "INVALID_PROVIDER_STATE",
      "Checkout database row is malformed",
    );
  }
  const purpose = value.purpose;
  const targetId =
    purpose === "PROPOSAL" ? value.proposal_id : value.scope_change_id;
  return normalizeCheckoutRecord({
    id: value.id,
    requestNonce: value.request_nonce,
    purpose,
    targetId,
    clientUserId: value.client_user_id,
    providerUserId: value.provider_user_id,
    paymentProviderAccountId: value.payment_provider_account_id,
    providerName: value.provider_name,
    externalReference: value.external_reference,
    amountMinor: value.amount_minor,
    marketplaceFeeMinor: value.marketplace_fee_minor,
    providerNetExpectedMinor: value.provider_net_expected_minor,
    currencyCode: value.currency_code,
    status: value.status,
    providerCheckoutReference: value.provider_checkout_reference,
    checkoutUrl: value.checkout_url,
  });
}

async function findCheckoutByNonce(
  requestNonce: string,
): Promise<CheckoutRecord | null> {
  const admin = getAdminTableClient();
  const result = await admin
    .from("payment_checkout_sessions")
    .select("*")
    .eq("request_nonce", requestNonce)
    .maybeSingle();
  if (result.error) {
    throwDatabaseError("Unable to read checkout session", result.error);
  }
  return result.data === null ? null : mapCheckoutDatabaseRow(result.data);
}

async function createCheckoutRecord(
  input: CheckoutRecordInput,
): Promise<CheckoutRecord> {
  const admin = getAdminTableClient();
  const result = await admin
    .from("payment_checkout_sessions")
    .insert({
      id: input.id,
      request_nonce: input.requestNonce,
      purpose: input.purpose,
      proposal_id: input.purpose === "PROPOSAL" ? input.targetId : null,
      scope_change_id:
        input.purpose === "SCOPE_CHANGE" ? input.targetId : null,
      client_user_id: input.clientUserId,
      provider_user_id: input.providerUserId,
      payment_provider_account_id: input.paymentProviderAccountId,
      provider_name: input.providerName,
      provider_checkout_reference: null,
      external_reference: input.externalReference,
      amount_minor: input.amountMinor,
      marketplace_fee_minor: input.marketplaceFeeMinor,
      provider_net_expected_minor: input.providerNetExpectedMinor,
      currency_code: input.currencyCode,
      status: "CREATED",
      checkout_url: null,
    })
    .select("*")
    .single();
  if (result.error) {
    throwDatabaseError("Unable to create durable checkout session", result.error);
  }
  return mapCheckoutDatabaseRow(result.data);
}

async function markCheckoutRedirectReady(input: {
  checkoutId: string;
  providerCheckoutReference: string;
  checkoutUrl: string;
}): Promise<void> {
  const admin = getAdminTableClient();
  const result = await admin
    .from("payment_checkout_sessions")
    .update({
      provider_checkout_reference: input.providerCheckoutReference,
      checkout_url: input.checkoutUrl,
      status: "REDIRECT_READY",
    })
    .eq("id", input.checkoutId)
    .select("id")
    .single();
  if (result.error || !isRecord(result.data)) {
    throwDatabaseError(
      "Unable to finalize durable checkout redirect",
      result.error,
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
    loadProposalCheckoutSnapshot,
    loadScopeChangeCheckoutSnapshot,
    loadConnectedProviderAccount,
    findCheckoutByNonce,
    createCheckoutRecord,
    markCheckoutRedirectReady,
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
      async createCheckoutSession(input) {
        const paymentEnv = getPaymentServerEnv();
        const provider = new MercadoPagoPaymentProvider({
          clientId: paymentEnv.clientId,
          clientSecret: paymentEnv.clientSecret,
          webhookSecret: paymentEnv.webhookSecret,
        });
        return provider.createCheckoutSession(input);
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

export async function createProposalCheckout(
  proposalId: string,
  requestNonce: string,
) {
  return getDefaultPaymentServer().createProposalCheckout(
    proposalId,
    requestNonce,
  );
}

export async function createScopeChangeCheckout(
  scopeChangeId: string,
  requestNonce: string,
) {
  return getDefaultPaymentServer().createScopeChangeCheckout(
    scopeChangeId,
    requestNonce,
  );
}
