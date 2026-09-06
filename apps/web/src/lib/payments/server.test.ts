import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptPaymentToken, encryptPaymentToken } from "./crypto";
import { createOAuthState, verifyOAuthState } from "./oauth-state";
import { createPaymentServer, PaymentServerError } from "./server";

const PROVIDER_USER_ID = "71100000-0000-4000-8000-000000000001";
const OTHER_PROVIDER_USER_ID = "71100000-0000-4000-8000-000000000002";
const CLIENT_USER_ID = "71100000-0000-4000-8000-000000000003";
const PROPOSAL_ID = "71120000-0000-4000-8000-000000000001";
const ACCEPTED_VERSION_ID = "71130000-0000-4000-8000-000000000001";
const SCOPE_CHANGE_ID = "71140000-0000-4000-8000-000000000001";
const JOB_ID = "71150000-0000-4000-8000-000000000001";
const PAYMENT_ACCOUNT_ID = "71160000-0000-4000-8000-000000000001";
const CHECKOUT_ID = "71170000-0000-4000-8000-000000000001";
const PROPOSAL_NONCE = "71180000-0000-4000-8000-000000000001";
const SCOPE_NONCE = "71180000-0000-4000-8000-000000000002";
const NOW = Date.UTC(2026, 8, 5, 21, 45, 0);
const TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
const STATE_SECRET = Buffer.alloc(32, 9).toString("base64");

const paymentEnv = {
  clientId: "phase11-client-id",
  clientSecret: "phase11-client-secret",
  webhookSecret: "phase11-webhook-secret",
  tokenEncryptionKey: TOKEN_KEY,
  tokenEncryptionKeyVersion: 1,
  oauthStateSecret: STATE_SECRET,
  marketplaceFeeBps: 1000,
  providerMode: "test" as const,
};

function makeServer(
  overrides: {
    currentUserId?: string | null;
    providerExists?: boolean;
    accountState?: Record<string, unknown> | null;
    exchangeResult?: Record<string, unknown>;
  } = {},
) {
  const persisted: unknown[] = [];
  const exchangeOAuthCode = vi.fn(
    async (_input: { code: string; redirectUri: string }) =>
      overrides.exchangeResult ?? {
        accessToken: "APP_USR-access-1",
        refreshToken: "TG-refresh-1",
        expiresInSeconds: 3600,
        providerAccountReference: "123456",
        scope: "offline_access read write",
      },
  );

  const server = createPaymentServer({
    now: () => NOW,
    siteUrl: "https://changas.test",
    paymentEnv,
    getCurrentUser: async () => {
      const id =
        overrides.currentUserId === undefined
          ? PROVIDER_USER_ID
          : overrides.currentUserId;
      return id ? { id } : null;
    },
    hasProviderProfile: async (_userId: string) =>
      overrides.providerExists ?? true,
    getAccountState: async (_userId: string) =>
      overrides.accountState === undefined ? null : overrides.accountState,
    upsertAccount: async (input: unknown) => {
      persisted.push(input);
    },
    paymentProvider: { exchangeOAuthCode },
  });

  return { server, persisted, exchangeOAuthCode };
}

async function expectPaymentError(
  operation: () => Promise<unknown>,
  code: string,
) {
  const error = await operation().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(PaymentServerError);
  expect(error).toMatchObject({ code });
}

describe("Phase 11 seller OAuth payment server", () => {
  it("requires an authenticated provider for account reads and OAuth start", async () => {
    const { server } = makeServer({ currentUserId: null });

    await expectPaymentError(
      () => server.getProviderPaymentAccountState(),
      "UNAUTHORIZED",
    );
    await expectPaymentError(
      () => server.buildMercadoPagoOAuthRedirect(),
      "UNAUTHORIZED",
    );
  });

  it("rejects authenticated users without a provider profile", async () => {
    const { server } = makeServer({ providerExists: false });

    await expectPaymentError(
      () => server.getProviderPaymentAccountState(),
      "FORBIDDEN",
    );
    await expectPaymentError(
      () => server.buildMercadoPagoOAuthRedirect(),
      "FORBIDDEN",
    );
  });

  it("builds a Mercado Pago authorization URL with state bound to the current provider", async () => {
    const { server } = makeServer();

    const redirectUrl = new URL(await server.buildMercadoPagoOAuthRedirect());

    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(
      "https://auth.mercadopago.com.ar/authorization",
    );
    expect(redirectUrl.searchParams.get("client_id")).toBe("phase11-client-id");
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("platform_id")).toBe("mp");
    expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
      "https://changas.test/api/payments/mercado-pago/oauth/callback",
    );

    const state = redirectUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(verifyOAuthState(state!, STATE_SECRET, NOW)).toMatchObject({
      providerUserId: PROVIDER_USER_ID,
      returnPath: "/provider/manage",
    });
  });

  it("rejects tampered, expired, and cross-provider OAuth state before code exchange", async () => {
    const { server, exchangeOAuthCode } = makeServer();
    const valid = createOAuthState(
      { providerUserId: PROVIDER_USER_ID, returnPath: "/provider/manage" },
      STATE_SECRET,
      NOW,
    );
    const expired = createOAuthState(
      { providerUserId: PROVIDER_USER_ID, returnPath: "/provider/manage" },
      STATE_SECRET,
      NOW - 11 * 60_000,
    );
    const crossProvider = createOAuthState(
      {
        providerUserId: OTHER_PROVIDER_USER_ID,
        returnPath: "/provider/manage",
      },
      STATE_SECRET,
      NOW,
    );

    await expectPaymentError(
      () =>
        server.completeMercadoPagoOAuthCallback({
          code: "code-1",
          state: `${valid.slice(0, -1)}x`,
        }),
      "INVALID_OAUTH_STATE",
    );
    await expectPaymentError(
      () =>
        server.completeMercadoPagoOAuthCallback({
          code: "code-1",
          state: expired,
        }),
      "INVALID_OAUTH_STATE",
    );
    await expectPaymentError(
      () =>
        server.completeMercadoPagoOAuthCallback({
          code: "code-1",
          state: crossProvider,
        }),
      "FORBIDDEN",
    );
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("exchanges the code, encrypts credentials, and persists a connected account without returning token material", async () => {
    const { server, persisted, exchangeOAuthCode } = makeServer();
    const state = createOAuthState(
      { providerUserId: PROVIDER_USER_ID, returnPath: "/provider/manage" },
      STATE_SECRET,
      NOW,
    );

    const result = await server.completeMercadoPagoOAuthCallback({
      code: "authorization-code-1",
      state,
    });

    expect(exchangeOAuthCode).toHaveBeenCalledWith({
      code: "authorization-code-1",
      redirectUri:
        "https://changas.test/api/payments/mercado-pago/oauth/callback",
    });
    expect(persisted).toHaveLength(1);
    const stored = persisted[0] as {
      providerUserId: string;
      providerName: string;
      providerAccountReference: string;
      accessToken: Parameters<typeof decryptPaymentToken>[0];
      refreshToken: Parameters<typeof decryptPaymentToken>[0];
      encryptionKeyVersion: number;
      scope: string | null;
      tokenExpiresAt: string;
      status: string;
    };
    expect(stored).toMatchObject({
      providerUserId: PROVIDER_USER_ID,
      providerName: "MERCADO_PAGO",
      providerAccountReference: "123456",
      encryptionKeyVersion: 1,
      scope: "offline_access read write",
      tokenExpiresAt: new Date(NOW + 3600_000).toISOString(),
      status: "CONNECTED",
    });
    expect(decryptPaymentToken(stored.accessToken, TOKEN_KEY)).toBe(
      "APP_USR-access-1",
    );
    expect(decryptPaymentToken(stored.refreshToken, TOKEN_KEY)).toBe(
      "TG-refresh-1",
    );
    expect(result).toMatchObject({
      returnPath: "/provider/manage",
      account: {
        providerName: "MERCADO_PAGO",
        providerAccountReference: "123456",
        status: "CONNECTED",
      },
    });
    const publicResult = JSON.stringify(result);
    expect(publicResult).not.toContain("APP_USR-access-1");
    expect(publicResult).not.toContain("TG-refresh-1");
    expect(publicResult).not.toContain("ciphertext");
    expect(publicResult).not.toContain("authTag");
  });

  it("persists the rotated refresh token when a disconnected or reauth-required seller reconnects", async () => {
    for (const status of ["DISCONNECTED", "REAUTH_REQUIRED"] as const) {
      const { server, persisted } = makeServer({
        accountState: {
          provider_name: "MERCADO_PAGO",
          provider_account_reference: "123456",
          status,
          token_expires_at: null,
          updated_at: "2026-09-05T20:00:00.000Z",
        },
        exchangeResult: {
          accessToken: "APP_USR-access-new",
          refreshToken: `TG-refresh-rotated-${status}`,
          expiresInSeconds: 7200,
          providerAccountReference: "123456",
          scope: "offline_access read write",
        },
      });
      const oauthUrl = await server.buildMercadoPagoOAuthRedirect();
      const state = new URL(oauthUrl).searchParams.get("state")!;

      await server.completeMercadoPagoOAuthCallback({
        code: `reauth-${status}`,
        state,
      });

      const stored = persisted[0] as {
        refreshToken: Parameters<typeof decryptPaymentToken>[0];
        status: string;
      };
      expect(stored.status).toBe("CONNECTED");
      expect(decryptPaymentToken(stored.refreshToken, TOKEN_KEY)).toBe(
        `TG-refresh-rotated-${status}`,
      );
    }
  });

  it("returns only the client-safe payment account state and a disconnected default", async () => {
    const connected = makeServer({
      accountState: {
        id: "71110000-0000-4000-8000-000000000001",
        provider_name: "MERCADO_PAGO",
        provider_account_reference: "123456",
        status: "CONNECTED",
        token_expires_at: "2027-03-05T21:45:00.000Z",
        updated_at: "2026-09-05T21:45:00.000Z",
      },
    });
    const disconnected = makeServer();

    expect(await connected.server.getProviderPaymentAccountState()).toEqual({
      providerName: "MERCADO_PAGO",
      providerAccountReference: "123456",
      status: "CONNECTED",
      tokenExpiresAt: "2027-03-05T21:45:00.000Z",
      updatedAt: "2026-09-05T21:45:00.000Z",
    });
    expect(await disconnected.server.getProviderPaymentAccountState()).toEqual({
      providerName: "MERCADO_PAGO",
      providerAccountReference: null,
      status: "DISCONNECTED",
      tokenExpiresAt: null,
      updatedAt: null,
    });
  });
});

type CheckoutRow = {
  id: string;
  requestNonce: string;
  purpose: "PROPOSAL" | "SCOPE_CHANGE";
  targetId: string;
  clientUserId: string;
  providerUserId: string;
  paymentProviderAccountId: string;
  providerName: "MERCADO_PAGO";
  externalReference: string;
  amountMinor: number;
  marketplaceFeeMinor: number;
  providerNetExpectedMinor: number;
  currencyCode: string;
  status: "CREATED" | "REDIRECT_READY";
  providerCheckoutReference: string | null;
  checkoutUrl: string | null;
};

function makeCheckoutServer(
  overrides: {
    currentUserId?: string | null;
    proposalSnapshot?: Record<string, unknown> | null;
    scopeSnapshot?: Record<string, unknown> | null;
    providerAccount?: Record<string, unknown> | null;
    existingCheckout?: CheckoutRow | null;
  } = {},
) {
  const createdRows: CheckoutRow[] = [];
  const finalizedRows: Array<{
    checkoutId: string;
    providerCheckoutReference: string;
    checkoutUrl: string;
  }> = [];
  const createCheckoutSession = vi.fn(async () => ({
    providerCheckoutReference: "pref-phase11-001",
    checkoutUrl:
      "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-phase11-001",
    sandboxCheckoutUrl: null,
  }));
  const accessToken = encryptPaymentToken(
    "APP_USR-seller-access",
    TOKEN_KEY,
    paymentEnv.tokenEncryptionKeyVersion,
  );

  const proposalSnapshot =
    overrides.proposalSnapshot === undefined
      ? {
          proposalId: PROPOSAL_ID,
          acceptedVersionId: ACCEPTED_VERSION_ID,
          clientUserId: CLIENT_USER_ID,
          providerUserId: PROVIDER_USER_ID,
          status: "AWAITING_PAYMENT",
          serviceTitle: "Instalación eléctrica",
          scopeSnapshot: "Instalación y revisión del tablero",
          amountMinor: 125000,
          currencyCode: "ARS",
        }
      : overrides.proposalSnapshot;
  const scopeSnapshot =
    overrides.scopeSnapshot === undefined
      ? {
          scopeChangeId: SCOPE_CHANGE_ID,
          jobId: JOB_ID,
          clientUserId: CLIENT_USER_ID,
          providerUserId: PROVIDER_USER_ID,
          status: "AWAITING_PAYMENT",
          serviceTitle: "Instalación eléctrica",
          scopeSnapshot: "Agregar dos tomas nuevas",
          amountMinor: 25000,
          currencyCode: "ARS",
        }
      : overrides.scopeSnapshot;
  const providerAccount =
    overrides.providerAccount === undefined
      ? {
          id: PAYMENT_ACCOUNT_ID,
          providerUserId: PROVIDER_USER_ID,
          providerName: "MERCADO_PAGO",
          providerAccountReference: "123456",
          status: "CONNECTED",
          accessToken,
          encryptionKeyVersion: 1,
        }
      : overrides.providerAccount;

  const server = createPaymentServer({
    now: () => NOW,
    siteUrl: "https://changas.test",
    paymentEnv,
    getCurrentUser: async () => {
      const id =
        overrides.currentUserId === undefined
          ? CLIENT_USER_ID
          : overrides.currentUserId;
      return id ? { id } : null;
    },
    hasProviderProfile: async () => false,
    getAccountState: async () => null,
    upsertAccount: async () => undefined,
    loadProposalCheckoutSnapshot: async () => proposalSnapshot,
    loadScopeChangeCheckoutSnapshot: async () => scopeSnapshot,
    loadConnectedProviderAccount: async () => providerAccount,
    findCheckoutByNonce: async () => overrides.existingCheckout ?? null,
    createCheckoutRecord: async (input: CheckoutRow) => {
      const row = { ...input, id: CHECKOUT_ID };
      createdRows.push(row);
      return row;
    },
    markCheckoutRedirectReady: async (input: {
      checkoutId: string;
      providerCheckoutReference: string;
      checkoutUrl: string;
    }) => {
      finalizedRows.push(input);
    },
    paymentProvider: {
      exchangeOAuthCode: async () => {
        throw new Error("OAuth exchange is not part of checkout creation");
      },
      createCheckoutSession,
    },
  });

  return { server, createdRows, finalizedRows, createCheckoutSession };
}

describe("Phase 11 durable real checkout creation", () => {
  it("creates a proposal checkout exclusively from the accepted durable snapshot and Task 1 commission helpers", async () => {
    const { server, createdRows, finalizedRows, createCheckoutSession } =
      makeCheckoutServer();

    const result = await server.createProposalCheckout(
      PROPOSAL_ID,
      PROPOSAL_NONCE,
    );

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "APP_USR-seller-access",
        title: "Instalación eléctrica",
        description: "Instalación y revisión del tablero",
        amountMinor: 125000,
        currencyCode: "ARS",
        marketplaceFeeMinor: 12500,
        externalReference: `changas:checkout:${PROPOSAL_NONCE}`,
        notificationUrl:
          "https://changas.test/api/payments/mercado-pago/webhook",
        backUrls: {
          success: "https://changas.test/payments/return/success",
          pending: "https://changas.test/payments/return/pending",
          failure: "https://changas.test/payments/return/failure",
        },
        idempotencyKey: PROPOSAL_NONCE,
      }),
    );
    expect(createdRows[0]).toMatchObject({
      purpose: "PROPOSAL",
      targetId: PROPOSAL_ID,
      clientUserId: CLIENT_USER_ID,
      providerUserId: PROVIDER_USER_ID,
      amountMinor: 125000,
      marketplaceFeeMinor: 12500,
      providerNetExpectedMinor: 112500,
      currencyCode: "ARS",
      status: "CREATED",
    });
    expect(finalizedRows).toEqual([
      {
        checkoutId: CHECKOUT_ID,
        providerCheckoutReference: "pref-phase11-001",
        checkoutUrl:
          "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-phase11-001",
      },
    ]);
    expect(result).toEqual({
      checkoutSessionId: CHECKOUT_ID,
      checkoutUrl:
        "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-phase11-001",
    });
  });

  it("creates additional-scope checkout from the accepted scope-change snapshot, never caller-supplied money", async () => {
    const { server, createdRows, createCheckoutSession } = makeCheckoutServer();

    await server.createScopeChangeCheckout(SCOPE_CHANGE_ID, SCOPE_NONCE);

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 25000,
        currencyCode: "ARS",
        marketplaceFeeMinor: 2500,
        idempotencyKey: SCOPE_NONCE,
      }),
    );
    expect(createdRows[0]).toMatchObject({
      purpose: "SCOPE_CHANGE",
      targetId: SCOPE_CHANGE_ID,
      amountMinor: 25000,
      marketplaceFeeMinor: 2500,
      providerNetExpectedMinor: 22500,
      currencyCode: "ARS",
    });
  });

  it("requires the authenticated client to own the payable snapshot and the seller to be connected", async () => {
    const wrongClient = makeCheckoutServer({
      currentUserId: OTHER_PROVIDER_USER_ID,
    });
    await expectPaymentError(
      () =>
        wrongClient.server.createProposalCheckout(PROPOSAL_ID, PROPOSAL_NONCE),
      "FORBIDDEN",
    );

    const disconnected = makeCheckoutServer({
      providerAccount: {
        id: PAYMENT_ACCOUNT_ID,
        providerUserId: PROVIDER_USER_ID,
        providerName: "MERCADO_PAGO",
        providerAccountReference: "123456",
        status: "REAUTH_REQUIRED",
      },
    });
    await expectPaymentError(
      () =>
        disconnected.server.createProposalCheckout(PROPOSAL_ID, PROPOSAL_NONCE),
      "SELLER_NOT_CONNECTED",
    );
  });

  it("reuses an existing redirect-ready session for the same nonce without another provider preference", async () => {
    const existingCheckout: CheckoutRow = {
      id: CHECKOUT_ID,
      requestNonce: PROPOSAL_NONCE,
      purpose: "PROPOSAL",
      targetId: PROPOSAL_ID,
      clientUserId: CLIENT_USER_ID,
      providerUserId: PROVIDER_USER_ID,
      paymentProviderAccountId: PAYMENT_ACCOUNT_ID,
      providerName: "MERCADO_PAGO",
      externalReference: `changas:checkout:${PROPOSAL_NONCE}`,
      amountMinor: 125000,
      marketplaceFeeMinor: 12500,
      providerNetExpectedMinor: 112500,
      currencyCode: "ARS",
      status: "REDIRECT_READY",
      providerCheckoutReference: "pref-existing",
      checkoutUrl:
        "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-existing",
    };
    const { server, createdRows, createCheckoutSession } = makeCheckoutServer({
      existingCheckout,
    });

    const result = await server.createProposalCheckout(
      PROPOSAL_ID,
      PROPOSAL_NONCE,
    );

    expect(result).toEqual({
      checkoutSessionId: CHECKOUT_ID,
      checkoutUrl: existingCheckout.checkoutUrl,
    });
    expect(createdRows).toHaveLength(0);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("keeps hosted-checkout return pages display-only with no financial mutation imports", () => {
    for (const outcome of ["success", "pending", "failure"] as const) {
      const source = readFileSync(
        join(
          process.cwd(),
          `apps/web/src/app/payments/return/${outcome}/page.tsx`,
        ),
        "utf8",
      );

      expect(source).not.toContain("reconcile_provider_payment");
      expect(source).not.toContain("apply_payment_result");
      expect(source).not.toContain("apply_additional_payment_result");
      expect(source).not.toContain("processMercadoPagoWebhook");
      expect(source).not.toContain("createProposalCheckout");
      expect(source).not.toContain("createScopeChangeCheckout");
      expect(source).not.toContain("providerPaymentReference");
      expect(source).not.toContain("payment_id");
    }
  });
});
