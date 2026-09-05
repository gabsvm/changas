import { describe, expect, it, vi } from "vitest";

import { decryptPaymentToken } from "./crypto";
import { createOAuthState, verifyOAuthState } from "./oauth-state";
import { createPaymentServer, PaymentServerError } from "./server";

const PROVIDER_USER_ID = "71100000-0000-4000-8000-000000000001";
const OTHER_PROVIDER_USER_ID = "71100000-0000-4000-8000-000000000002";
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
